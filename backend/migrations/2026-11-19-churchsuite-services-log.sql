-- ChurchSuite sync 4a part 2 (2026-11-19): two more logged actions — 'set_services' (which services a song is at,
-- with the old value) and 'add_item' (a non-song item at only some services). Safe to run more than once.
ALTER TABLE churchsuite_sync_log DROP CONSTRAINT IF EXISTS churchsuite_sync_log_action_check;
ALTER TABLE churchsuite_sync_log ADD CONSTRAINT churchsuite_sync_log_action_check
  CHECK (action IN ('add_song', 'reorder', 'set_key', 'add_musician', 'create_plan', 'set_services', 'add_item'));
