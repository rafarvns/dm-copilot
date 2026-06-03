package http

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/livresolucoes/dm-copilot-api/internal/db"
	"github.com/livresolucoes/dm-copilot-api/internal/domain"
	"github.com/livresolucoes/dm-copilot-api/internal/keys"
)

const (
	maxEmailLen  = 255
	maxNotesLen  = 4096
	defaultPage  = 1
	defaultPer   = 50
	maxPerPage   = 200
)

type createKeyRequest struct {
	CustomerEmail string `json:"customerEmail"`
	Notes         string `json:"notes"`
}

type createKeyResponse struct {
	OK        bool      `json:"ok"`
	Key       string    `json:"key"`
	CreatedAt time.Time `json:"createdAt"`
}

type listResponse struct {
	Items   []db.LicenseKey `json:"items"`
	Total   int             `json:"total"`
	Page    int             `json:"page"`
	PerPage int             `json:"perPage"`
}

func (s *Server) handleCreateKey(w http.ResponseWriter, r *http.Request) {
	var req createKeyRequest
	// Body is optional for this endpoint — empty body is fine.
	if r.Body != nil {
		r.Body = http.MaxBytesReader(nil, r.Body, 16*1024)
		dec := json.NewDecoder(r.Body)
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil && !errors.Is(err, io.EOF) {
			writeError(w, http.StatusBadRequest, domain.ErrCodeBadRequest)
			return
		}
	}

	email := strings.TrimSpace(req.CustomerEmail)
	notes := strings.TrimSpace(req.Notes)
	if len(email) > maxEmailLen || len(notes) > maxNotesLen {
		writeError(w, http.StatusBadRequest, domain.ErrCodeBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Retry on the astronomically rare PK collision: regenerate and try again.
	const maxAttempts = 3
	var (
		stored *db.LicenseKey
		err    error
	)
	for attempt := 0; attempt < maxAttempts; attempt++ {
		key, genErr := keys.Generate()
		if genErr != nil {
			s.logger.Error("key generation failed", "err", genErr)
			writeError(w, http.StatusInternalServerError, domain.ErrCodeInternal)
			return
		}
		stored, err = s.store.InsertKey(ctx, key, nullableString(email), nullableString(notes))
		if err == nil {
			break
		}
		// We don't distinguish PK collision from other errors here — pgx exposes
		// SQLSTATE 23505 but importing pgconn just for that is overkill. Logging
		// + retry is sufficient: any persistent failure surfaces after 3 attempts.
		s.logger.Warn("insert key attempt failed", "err", err, "attempt", attempt+1)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, domain.ErrCodeInternal)
		return
	}

	s.logger.Info("admin created key", "key", keys.Mask(stored.Key))
	writeJSON(w, http.StatusCreated, createKeyResponse{
		OK:        true,
		Key:       stored.Key,
		CreatedAt: stored.CreatedAt.UTC(),
	})
}

func (s *Server) handleListKeys(w http.ResponseWriter, r *http.Request) {
	page := parsePositiveInt(r.URL.Query().Get("page"), defaultPage, 1<<20)
	perPage := parsePositiveInt(r.URL.Query().Get("perPage"), defaultPer, maxPerPage)
	offset := (page - 1) * perPage

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	items, err := s.store.ListKeys(ctx, perPage, offset)
	if err != nil {
		s.logger.Error("list keys failed", "err", err)
		writeError(w, http.StatusInternalServerError, domain.ErrCodeInternal)
		return
	}
	total, err := s.store.CountKeys(ctx)
	if err != nil {
		s.logger.Error("count keys failed", "err", err)
		writeError(w, http.StatusInternalServerError, domain.ErrCodeInternal)
		return
	}

	writeJSON(w, http.StatusOK, listResponse{
		Items:   items,
		Total:   total,
		Page:    page,
		PerPage: perPage,
	})
}

func (s *Server) handleGetKey(w http.ResponseWriter, r *http.Request) {
	raw := r.PathValue("key")
	normalized, ok := keys.Normalize(raw)
	if !ok {
		writeError(w, http.StatusNotFound, domain.ErrCodeNotFound)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	row, err := s.store.GetKey(ctx, normalized)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, domain.ErrCodeNotFound)
		return
	}
	if err != nil {
		s.logger.Error("get key failed", "err", err)
		writeError(w, http.StatusInternalServerError, domain.ErrCodeInternal)
		return
	}
	writeJSON(w, http.StatusOK, row)
}

func (s *Server) handleRevokeKey(w http.ResponseWriter, r *http.Request) {
	raw := r.PathValue("key")
	normalized, ok := keys.Normalize(raw)
	if !ok {
		writeError(w, http.StatusNotFound, domain.ErrCodeNotFound)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	err := s.store.RevokeKey(ctx, normalized)
	switch {
	case err == nil:
		s.logger.Info("admin revoked key", "key", keys.Mask(normalized))
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	case errors.Is(err, sql.ErrNoRows):
		writeError(w, http.StatusNotFound, domain.ErrCodeNotFound)
	case errors.Is(err, db.ErrAlreadyRevoked):
		writeError(w, http.StatusConflict, domain.ErrCodeAlreadyRevoked)
	default:
		s.logger.Error("revoke failed", "err", err)
		writeError(w, http.StatusInternalServerError, domain.ErrCodeInternal)
	}
}

func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func parsePositiveInt(raw string, def, max int) int {
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return def
	}
	if n > max {
		return max
	}
	return n
}
