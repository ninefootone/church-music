-- ChurchSuite scheduled "shadow" report (stage 1 of the ChurchSuite link-up).
-- Stores the last dry-run report per church so the cron job only emails when something changed.
-- Nothing in SongStack reads this table. Applied via Railway → Postgres → Data tab.
BEGIN;
CREATE TABLE IF NOT EXISTS churchsuite_shadow_reports (
  id          BIGSERIAL PRIMARY KEY,
  church_id   UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  report_hash TEXT NOT NULL,
  report_text TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS churchsuite_shadow_reports_church_created_idx
  ON churchsuite_shadow_reports (church_id, created_at DESC);
COMMIT;

-- Check (run separately): expect 5 columns and the index.
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'churchsuite_shadow_reports' ORDER BY ordinal_position;
-- SELECT indexname FROM pg_indexes WHERE tablename = 'churchsuite_shadow_reports';
