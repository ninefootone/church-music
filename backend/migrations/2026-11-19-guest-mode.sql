-- Guest mode, groundwork (2026-11-19, project doc guest-mode.md).
-- 1. memberships.role may now be 'guest' (guest musicians: see only the plans they're on).
-- 2. plan_musicians gets a one-time claim link for a guest musician row.
--    Only a SHA-256 hash of the token is stored; the link itself is shown once to the admin.
--    Guest access ends 7 days after their latest plan — worked out from plan dates, so no column for it.
-- Additive only: nothing writes 'guest' or the new columns yet. Safe to run more than once.
BEGIN;

ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE memberships ADD CONSTRAINT memberships_role_check
  CHECK (role IN ('admin', 'member', 'revoked', 'guest'));

ALTER TABLE plan_musicians ADD COLUMN IF NOT EXISTS guest_token_hash TEXT;
ALTER TABLE plan_musicians ADD COLUMN IF NOT EXISTS guest_token_expires_at TIMESTAMPTZ;
ALTER TABLE plan_musicians ADD COLUMN IF NOT EXISTS guest_claimed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS plan_musicians_guest_token_hash_key
  ON plan_musicians (guest_token_hash) WHERE guest_token_hash IS NOT NULL;

-- Guest access checks look up "plans this user is on".
CREATE INDEX IF NOT EXISTS plan_musicians_user_id_idx ON plan_musicians (user_id);

COMMIT;

-- Check 1: should show the role check including 'guest'.
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'memberships_role_check';
-- Check 2: should show the three new columns.
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'plan_musicians' AND column_name LIKE 'guest_%' ORDER BY column_name;
