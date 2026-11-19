-- ChurchSuite sync — truth model (2026-11-19): ChurchSuite controls the running order of the plans it syncs.
-- More logged actions (so undo-last-run can put them back) + a marker for the builder notice. Safe to run twice.
ALTER TABLE churchsuite_sync_log DROP CONSTRAINT IF EXISTS churchsuite_sync_log_action_check;
ALTER TABLE churchsuite_sync_log ADD CONSTRAINT churchsuite_sync_log_action_check
  CHECK (action IN ('add_song', 'reorder', 'set_key', 'add_musician', 'create_plan', 'set_services', 'add_item',
                    'remove_item', 'remove_musician', 'set_item', 'set_plan_times'));
-- When the sync last matched this plan to ChurchSuite (NULL = never). The plan builder shows a notice when set.
ALTER TABLE plans ADD COLUMN IF NOT EXISTS churchsuite_synced_at TIMESTAMPTZ;
