-- ChurchSuite sync item 4a (2026-11-18): the sync can now CREATE plans, logged as 'create_plan'.
-- Lets that action into churchsuite_sync_log. Safe to run more than once.
ALTER TABLE churchsuite_sync_log DROP CONSTRAINT IF EXISTS churchsuite_sync_log_action_check;
ALTER TABLE churchsuite_sync_log ADD CONSTRAINT churchsuite_sync_log_action_check
  CHECK (action IN ('add_song', 'reorder', 'set_key', 'add_musician', 'create_plan'));
