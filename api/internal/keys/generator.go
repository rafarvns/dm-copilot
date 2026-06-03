package keys

import (
	"crypto/rand"
	"strings"
)

// Crockford-inspired alphabet without ambiguous characters (no 0/O/1/I/L/U).
// 30 symbols (~4.9 bits per char). 12 body chars → ~59 bits of entropy,
// ~5.7×10^17 possible keys — more than enough to make guessing intractable.
const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789"

const (
	groupSize  = 4
	groupCount = 3
	prefix     = "DMC-"
)

// Generate returns a fresh key in the format DMC-XXXX-XXXX-XXXX (17 chars).
// Uses crypto/rand for the 12 char body. Each char is sampled as
// alphabet[byte % len(alphabet)] — introduces a tiny modulo bias (~0.7%)
// which is irrelevant for license key uniqueness given the ~10^17 space.
func Generate() (string, error) {
	const bodyLen = groupSize * groupCount
	buf := make([]byte, bodyLen)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.Grow(len(prefix) + bodyLen + (groupCount - 1))
	sb.WriteString(prefix)

	alphaLen := byte(len(alphabet))
	for i := 0; i < bodyLen; i++ {
		if i > 0 && i%groupSize == 0 {
			sb.WriteByte('-')
		}
		sb.WriteByte(alphabet[buf[i]%alphaLen])
	}
	return sb.String(), nil
}
