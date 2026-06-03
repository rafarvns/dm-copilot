package http

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/livresolucoes/dm-copilot-api/internal/config"
	"github.com/livresolucoes/dm-copilot-api/internal/db"
)

type Server struct {
	store  *db.Store
	logger *slog.Logger
}

// NewServer wires routes, middleware, and timeouts into a stdlib *http.Server
// ready to ListenAndServe. Routing relies on Go 1.22+ ServeMux pattern syntax
// (method + path with {param} captures), avoiding any third-party router.
func NewServer(cfg *config.Config, store *db.Store, logger *slog.Logger) *http.Server {
	s := &Server{store: store, logger: logger}

	mux := http.NewServeMux()

	// Public endpoints.
	mux.HandleFunc("POST /activate", s.handleActivate)
	mux.HandleFunc("POST /deactivate", s.handleDeactivate)
	mux.HandleFunc("GET /health", s.handleHealth)

	// Admin endpoints, mounted behind the X-Admin-Key middleware.
	admin := http.NewServeMux()
	admin.HandleFunc("POST /admin/keys", s.handleCreateKey)
	admin.HandleFunc("GET /admin/keys", s.handleListKeys)
	admin.HandleFunc("GET /admin/keys/{key}", s.handleGetKey)
	admin.HandleFunc("POST /admin/keys/{key}/revoke", s.handleRevokeKey)

	gateAdmin := adminAuth(cfg.AdminAPIKey)
	mux.Handle("/admin/", gateAdmin(admin))

	// Global middleware chain: recover panics first, then log every request.
	wrap := chain(recoverer(logger), requestLog(logger))

	return &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           wrap(mux),
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
		ReadHeaderTimeout: 5 * time.Second,
		MaxHeaderBytes:    1 << 14,
	}
}
