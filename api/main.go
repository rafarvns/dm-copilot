package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/livresolucoes/dm-copilot-api/internal/config"
	"github.com/livresolucoes/dm-copilot-api/internal/db"
	httpapi "github.com/livresolucoes/dm-copilot-api/internal/http"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.New(slog.NewJSONHandler(os.Stderr, nil)).Error("config load failed", "err", err)
		os.Exit(1)
	}

	logger := newLogger(cfg.LogLevel)
	slog.SetDefault(logger)

	logger.Info("starting dmc-api", "port", cfg.Port, "log_level", cfg.LogLevel)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		logger.Error("database open failed", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	bootCtx, bootCancel := context.WithTimeout(ctx, 10*time.Second)
	if err := db.Ping(bootCtx, pool); err != nil {
		bootCancel()
		logger.Error("database ping failed", "err", err)
		os.Exit(1)
	}
	if err := db.EnsureSchema(bootCtx, pool); err != nil {
		bootCancel()
		logger.Error("schema ensure failed", "err", err)
		os.Exit(1)
	}
	bootCancel()
	logger.Info("schema ready")

	store := db.NewStore(pool)
	server := httpapi.NewServer(cfg, store, logger)

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("http server listening", "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
		close(serverErr)
	}()

	select {
	case <-ctx.Done():
		logger.Info("shutdown signal received")
	case err := <-serverErr:
		if err != nil {
			logger.Error("server error", "err", err)
			os.Exit(1)
		}
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "err", err)
		os.Exit(1)
	}
	logger.Info("server stopped cleanly")
}

func newLogger(level string) *slog.Logger {
	var lvl slog.Level
	switch level {
	case "debug":
		lvl = slog.LevelDebug
	case "warn":
		lvl = slog.LevelWarn
	case "error":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lvl})
	return slog.New(handler)
}
