-- UNDO the most recent ChurchSuite sync run that changed anything. Paste into Railway → Postgres → Data tab.
-- Puts song positions back, removes songs and musicians the run added, clears keys it set
-- (only if nobody has changed that key since). Then removes that run from the log, so running
-- this again undoes the run before it.
BEGIN;

CREATE TEMP TABLE undo_run ON COMMIT DROP AS
  SELECT * FROM churchsuite_sync_log
   WHERE run_id = (SELECT run_id FROM churchsuite_sync_log ORDER BY created_at DESC, id DESC LIMIT 1);

-- 1. Positions back to before the reorder.
UPDATE plan_items pi SET position = (b.value)::int
  FROM undo_run u, jsonb_each_text(u.detail->'before') b
 WHERE u.action = 'reorder' AND pi.id = (b.key)::uuid AND pi.plan_id = u.plan_id;

-- 2. Songs the run added.
DELETE FROM plan_items pi USING undo_run u
 WHERE u.action = 'add_song' AND pi.id = (u.detail->>'item_id')::uuid AND pi.plan_id = u.plan_id;

-- 3. Keys the run filled in (left alone if someone has changed it since).
UPDATE plan_items pi SET key_override = NULL
  FROM undo_run u
 WHERE u.action = 'set_key' AND pi.id = (u.detail->>'item_id')::uuid AND pi.key_override = u.detail->>'key';

-- 4. Musicians the run added.
DELETE FROM plan_musicians pm USING undo_run u
 WHERE u.action = 'add_musician' AND pm.id = (u.detail->>'musician_id')::uuid AND pm.plan_id = u.plan_id;

DELETE FROM churchsuite_sync_log WHERE run_id = (SELECT DISTINCT run_id FROM undo_run);

SELECT action, detail, created_at FROM undo_run ORDER BY id;   -- what was undone
COMMIT;
