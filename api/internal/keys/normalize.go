package keys

import (
	"regexp"
	"strings"
)

const (
	MinLength = 12
	MaxLength = 64
)

var keyPattern = regexp.MustCompile(`^DMC-[A-Z0-9-]{8,}$`)

// Normalize trims, uppercases, and validates the key against the canonical
// format. Returns the normalized key and true if valid; empty string and false
// otherwise. All callers that pass `key` into a SQL query must normalize first
// so the primary key in license_keys is canonical.
func Normalize(s string) (string, bool) {
	s = strings.TrimSpace(s)
	if len(s) < MinLength || len(s) > MaxLength {
		return "", false
	}
	s = strings.ToUpper(s)
	if !keyPattern.MatchString(s) {
		return "", false
	}
	return s, true
}

// Mask returns a short safe representation for logs: "DMC-XXXX…" or "" if too short.
func Mask(key string) string {
	if len(key) < 8 {
		return ""
	}
	return key[:8] + "…"
}
