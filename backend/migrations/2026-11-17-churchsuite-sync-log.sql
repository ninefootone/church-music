-- ChurchSuite sync, minimal first version: a log of every change the sync makes, with what it was
-- before, so any run can be undone (backend/migrations/2026-11-17-churchsuite-undo-last-run.sql).
-- Applied via Railway → Postgres → Data tab.
BEGIN;
CREATE TABLE IF NOT EXISTS churchsuite_sync_log (
  id         BIGSERIAL PRIMARY KEY,
  run_id     UUID NOT NULL,
  church_id  UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  plan_id    UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  action     TEXT NOT NULL CHECK (action IN ('add_song', 'reorder', 'set_key', 'add_musician')),
  detail     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS churchsuite_sync_log_run_idx ON churchsuite_sync_log (run_id);
CREATE INDEX IF NOT EXISTS churchsuite_sync_log_created_idx ON churchsuite_sync_log (created_at DESC);
COMMIT;

-- Check (run separately): expect 7 columns.
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'churchsuite_sync_log' ORDER BY ordinal_position;
