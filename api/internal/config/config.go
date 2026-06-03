package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

type Config struct {
	DatabaseURL   string
	Port          string
	AdminAPIKey   string
	LogLevel      string
	ReadTimeout   time.Duration
	WriteTimeout  time.Duration
	IdleTimeout   time.Duration
}

func Load() (*Config, error) {
	cfg := &Config{
		DatabaseURL:  strings.TrimSpace(os.Getenv("DATABASE_URL")),
		Port:         getenvDefault("PORT", "8080"),
		AdminAPIKey:  strings.TrimSpace(os.Getenv("ADMIN_API_KEY")),
		LogLevel:     strings.ToLower(getenvDefault("LOG_LEVEL", "info")),
		ReadTimeout:  parseDurationDefault("READ_TIMEOUT", 5*time.Second),
		WriteTimeout: parseDurationDefault("WRITE_TIMEOUT", 10*time.Second),
		IdleTimeout:  parseDurationDefault("IDLE_TIMEOUT", 60*time.Second),
	}

	var missing []string
	if cfg.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if cfg.AdminAPIKey == "" {
		missing = append(missing, "ADMIN_API_KEY")
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("missing required env vars: %s", strings.Join(missing, ", "))
	}

	if !validLogLevel(cfg.LogLevel) {
		return nil, errors.New("LOG_LEVEL must be one of: debug, info, warn, error")
	}

	return cfg, nil
}

func getenvDefault(key, def string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	return v
}

func parseDurationDefault(key string, def time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	d, err := time.ParseDuration(raw)
	if err != nil || d <= 0 {
		return def
	}
	return d
}

func validLogLevel(lvl string) bool {
	switch lvl {
	case "debug", "info", "warn", "error":
		return true
	}
	return false
}
