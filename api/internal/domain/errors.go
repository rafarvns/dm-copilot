package domain

const (
	ErrCodeBadRequest     = "BAD_REQUEST"
	ErrCodeInvalidFormat  = "INVALID_FORMAT"
	ErrCodeInvalidKey     = "INVALID_KEY"
	ErrCodeKeyRevoked     = "KEY_REVOKED"
	ErrCodeLocked         = "ALREADY_ACTIVATED_ON_OTHER_MACHINE"
	ErrCodeNotFound       = "NOT_FOUND"
	ErrCodeAlreadyRevoked = "ALREADY_REVOKED"
	ErrCodeUnauthorized   = "UNAUTHORIZED"
	ErrCodeInternal       = "INTERNAL_ERROR"
	ErrCodeUnavailable    = "SERVICE_UNAVAILABLE"
)

const (
	StatusActive  = "active"
	StatusRevoked = "revoked"
)
