package db

import (
	"context"
	"database/sql"
)

// schemaSQL is idempotent. Boot runs it every start; CREATE ... IF NOT EXISTS
// covers fresh installs and reboots equally. When evolving the schema, prefer
// ALTER TABLE ... ADD COLUMN IF NOT EXISTS so older replicas still boot. When
// this block grows past ~5 statements or needs reversible migrations, switch
// to golang-migrate (documented as a known debt in the README).
const schemaSQL = `
CREATE TABLE IF NOT EXISTS license_keys (
    key             VARCHAR(64) PRIMARY KEY,
    machine_id      VARCHAR(128),
    customer_email  VARCHAR(255),
    notes           TEXT,
    status          VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at    TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    last_seen_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_license_keys_machine_id
    ON license_keys(machine_id) WHERE machine_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_license_keys_status
    ON license_keys(status);

CREATE INDEX IF NOT EXISTS idx_license_keys_created_at
    ON license_keys(created_at DESC);
`

func EnsureSchema(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, schemaSQL)
	return err
}
