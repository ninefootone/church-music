// Plan templates remember extra service times (2026-10-24). See multi-service-plans.md.
// Applied via the Railway Postgres Data tab (no public DB address since the Oct 2026 breach):
//   BEGIN;
//   ALTER TABLE plan_templates ADD COLUMN IF NOT EXISTS extra_times TIME[] NOT NULL DEFAULT '{}';
//   ALTER TABLE plan_templates DROP CONSTRAINT IF EXISTS plan_templates_extra_times_max_check;
//   ALTER TABLE plan_templates ADD CONSTRAINT plan_templates_extra_times_max_check CHECK (cardinality(extra_times) <= 3);
//   COMMIT;
// This file is the record of what was run; it is not executed.
