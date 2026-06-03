package db

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/livresolucoes/dm-copilot-api/internal/domain"
)

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Ping(ctx context.Context) error {
	return s.db.PingContext(ctx)
}

type LicenseKey struct {
	Key           string     `json:"key"`
	MachineID     *string    `json:"machineId,omitempty"`
	CustomerEmail *string    `json:"customerEmail,omitempty"`
	Notes         *string    `json:"notes,omitempty"`
	Status        string     `json:"status"`
	CreatedAt     time.Time  `json:"createdAt"`
	ActivatedAt   *time.Time `json:"activatedAt,omitempty"`
	RevokedAt     *time.Time `json:"revokedAt,omitempty"`
	LastSeenAt    *time.Time `json:"lastSeenAt,omitempty"`
}

// ActivateOutcome distinguishes the four terminal cases of an ActivateKey call
// without leaking sql.ErrNoRows up to handlers.
type ActivateOutcome int

const (
	ActivateOK ActivateOutcome = iota
	ActivateNotFound
	ActivateRevoked
	ActivateLocked
)

type ActivateResult struct {
	Outcome     ActivateOutcome
	ActivatedAt time.Time
}

// ErrAlreadyRevoked is returned by RevokeKey when the row exists but is already
// in the revoked state. The handler maps it to a 409.
var ErrAlreadyRevoked = errors.New("license key already revoked")

const colSelect = `
    key, machine_id, customer_email, notes, status,
    created_at, activated_at, revoked_at, last_seen_at
`

func scanKey(row interface {
	Scan(dest ...any) error
}) (*LicenseKey, error) {
	var k LicenseKey
	if err := row.Scan(
		&k.Key,
		&k.MachineID,
		&k.CustomerEmail,
		&k.Notes,
		&k.Status,
		&k.CreatedAt,
		&k.ActivatedAt,
		&k.RevokedAt,
		&k.LastSeenAt,
	); err != nil {
		return nil, err
	}
	return &k, nil
}

func (s *Store) GetKey(ctx context.Context, key string) (*LicenseKey, error) {
	row := s.db.QueryRowContext(ctx, `SELECT `+colSelect+` FROM license_keys WHERE key = $1`, key)
	return scanKey(row)
}

func (s *Store) InsertKey(ctx context.Context, key string, customerEmail, notes *string) (*LicenseKey, error) {
	const q = `
        INSERT INTO license_keys (key, customer_email, notes)
        VALUES ($1, $2, $3)
        RETURNING ` + colSelect
	row := s.db.QueryRowContext(ctx, q, key, customerEmail, notes)
	return scanKey(row)
}

// ActivateKey runs the locking UPDATE in one atomic statement. The WHERE
// clause `machine_id IS NULL OR machine_id = $2` lets Postgres serialize
// concurrent activations of the same key from different machines — only the
// first one wins. On miss, a single follow-up SELECT classifies why.
func (s *Store) ActivateKey(ctx context.Context, key, machineID string) (ActivateResult, error) {
	const update = `
        UPDATE license_keys
        SET machine_id   = COALESCE(machine_id, $2),
            activated_at = COALESCE(activated_at, NOW()),
            last_seen_at = NOW()
        WHERE key = $1
          AND status = 'active'
          AND (machine_id IS NULL OR machine_id = $2)
        RETURNING activated_at
    `

	var activatedAt time.Time
	err := s.db.QueryRowContext(ctx, update, key, machineID).Scan(&activatedAt)
	if err == nil {
		return ActivateResult{Outcome: ActivateOK, ActivatedAt: activatedAt}, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return ActivateResult{}, err
	}

	// Miss: classify.
	var (
		status        string
		existingMachi sql.NullString
	)
	probe := `SELECT status, machine_id FROM license_keys WHERE key = $1`
	if err := s.db.QueryRowContext(ctx, probe, key).Scan(&status, &existingMachi); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ActivateResult{Outcome: ActivateNotFound}, nil
		}
		return ActivateResult{}, err
	}

	if status == domain.StatusRevoked {
		return ActivateResult{Outcome: ActivateRevoked}, nil
	}
	if existingMachi.Valid && existingMachi.String != machineID {
		return ActivateResult{Outcome: ActivateLocked}, nil
	}
	// Status is active and machine matches (or is null) but the UPDATE missed.
	// This branch is effectively unreachable; treat it as a transient failure.
	return ActivateResult{}, errors.New("activate: inconsistent state")
}

// DeactivateKey clears the machine_id binding when the caller proves ownership
// via the matching machineId. Missing rows or mismatched machineIds are silent
// no-ops by design — the handler returns 200 either way to avoid leaking
// existence information through this endpoint.
func (s *Store) DeactivateKey(ctx context.Context, key, machineID string) error {
	const q = `
        UPDATE license_keys
        SET machine_id   = NULL,
            activated_at = NULL,
            last_seen_at = NOW()
        WHERE key = $1 AND machine_id = $2 AND status = 'active'
    `
	_, err := s.db.ExecContext(ctx, q, key, machineID)
	return err
}

// RevokeKey transitions an active row to revoked. Returns:
//   - nil on success
//   - sql.ErrNoRows when the key doesn't exist
//   - ErrAlreadyRevoked when the row exists but was already revoked
func (s *Store) RevokeKey(ctx context.Context, key string) error {
	const q = `
        UPDATE license_keys
        SET status = 'revoked',
            revoked_at = NOW()
        WHERE key = $1 AND status = 'active'
    `
	result, err := s.db.ExecContext(ctx, q, key)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 1 {
		return nil
	}

	// Zero rows: either the key is missing or it was already revoked.
	var existing string
	probe := `SELECT status FROM license_keys WHERE key = $1`
	if err := s.db.QueryRowContext(ctx, probe, key).Scan(&existing); err != nil {
		return err
	}
	// Existing row guaranteed to be 'revoked' here since 'active' would have matched.
	return ErrAlreadyRevoked
}

func (s *Store) ListKeys(ctx context.Context, limit, offset int) ([]LicenseKey, error) {
	const q = `
        SELECT ` + colSelect + `
        FROM license_keys
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
    `
	rows, err := s.db.QueryContext(ctx, q, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]LicenseKey, 0, limit)
	for rows.Next() {
		k, err := scanKey(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *k)
	}
	return out, rows.Err()
}

func (s *Store) CountKeys(ctx context.Context) (int, error) {
	var n int
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM license_keys`).Scan(&n)
	return n, err
}
