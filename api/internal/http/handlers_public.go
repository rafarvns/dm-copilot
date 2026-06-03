package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/livresolucoes/dm-copilot-api/internal/db"
	"github.com/livresolucoes/dm-copilot-api/internal/domain"
	"github.com/livresolucoes/dm-copilot-api/internal/keys"
)

const maxMachineIDLen = 128

type activateRequest struct {
	Key       string `json:"key"`
	MachineID string `json:"machineId"`
}

type activateResponse struct {
	OK          bool      `json:"ok"`
	ActivatedAt time.Time `json:"activatedAt"`
}

func decodeJSON(r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(nil, r.Body, 16*1024)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}

func (s *Server) handleActivate(w http.ResponseWriter, r *http.Request) {
	var req activateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, domain.ErrCodeBadRequest)
		return
	}

	machineID := strings.TrimSpace(req.MachineID)
	if machineID == "" || len(machineID) > maxMachineIDLen {
		writeError(w, http.StatusBadRequest, domain.ErrCodeBadRequest)
		return
	}

	normalized, ok := keys.Normalize(req.Key)
	if !ok {
		writeError(w, http.StatusBadRequest, domain.ErrCodeInvalidFormat)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	res, err := s.store.ActivateKey(ctx, normalized, machineID)
	if err != nil {
		s.logger.Error("activate failed", "err", err, "key", keys.Mask(normalized))
		writeError(w, http.StatusInternalServerError, domain.ErrCodeInternal)
		return
	}

	switch res.Outcome {
	case db.ActivateOK:
		s.logger.Info("activate ok", "key", keys.Mask(normalized))
		writeJSON(w, http.StatusOK, activateResponse{OK: true, ActivatedAt: res.ActivatedAt.UTC()})
	case db.ActivateNotFound:
		writeError(w, http.StatusNotFound, domain.ErrCodeInvalidKey)
	case db.ActivateRevoked:
		writeError(w, http.StatusForbidden, domain.ErrCodeKeyRevoked)
	case db.ActivateLocked:
		writeError(w, http.StatusConflict, domain.ErrCodeLocked)
	default:
		writeError(w, http.StatusInternalServerError, domain.ErrCodeInternal)
	}
}

func (s *Server) handleDeactivate(w http.ResponseWriter, r *http.Request) {
	var req activateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, domain.ErrCodeBadRequest)
		return
	}
	machineID := strings.TrimSpace(req.MachineID)
	if machineID == "" || len(machineID) > maxMachineIDLen {
		writeError(w, http.StatusBadRequest, domain.ErrCodeBadRequest)
		return
	}
	normalized, ok := keys.Normalize(req.Key)
	if !ok {
		// Silent no-op preserves "doesn't leak existence" behavior of /deactivate.
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	if err := s.store.DeactivateKey(ctx, normalized, machineID); err != nil {
		s.logger.Error("deactivate failed", "err", err, "key", keys.Mask(normalized))
		writeError(w, http.StatusInternalServerError, domain.ErrCodeInternal)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.store.Ping(ctx); err != nil {
		s.logger.Warn("health db ping failed", "err", err)
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"status": "degraded",
			"reason": "db",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
}

