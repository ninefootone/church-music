-- Per-service items (2026-11-18, project doc per-service-items.md).
-- On a plan with extra service times, an item can happen at only some of them (e.g. a baptism at
-- 9:15 only). '{}' = every service, which is what every existing item gets — so nothing changes
-- for existing plans. Safe to run more than once.
ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS service_times TIME[] NOT NULL DEFAULT '{}';

-- Check: should show one row, data_type ARRAY, default '{}'::time without time zone[].
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_name = 'plan_items' AND column_name = 'service_times';
