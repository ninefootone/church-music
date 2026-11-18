-- UNDO the most recent ChurchSuite sync run that changed anything. Paste into Railway → Postgres → Data tab.
-- Deletes plans the run CREATED (only if nobody has edited them since — same fingerprint as when created),
-- puts song positions back, removes songs and musicians the run added, clears keys it set
-- (only if nobody has changed that key since). Then removes that run from the log, so running
-- this again undoes the run before it.
BEGIN;

CREATE TEMP TABLE undo_run ON COMMIT DROP AS
  SELECT * FROM churchsuite_sync_log
   WHERE run_id = (SELECT run_id FROM churchsuite_sync_log ORDER BY created_at DESC, id DESC LIMIT 1);

-- 0. Plans the run created (item 4a), if unedited since. Fingerprint = PLAN_FINGERPRINT_SQL in churchsuite-sync.js.
--    (The plan's own log rows go with it — ON DELETE CASCADE — but undo_run already holds a copy.)
DELETE FROM plans p USING undo_run u
 WHERE u.action = 'create_plan' AND p.id = u.plan_id AND u.detail->>'fp' = md5(
   COALESCE((SELECT string_agg(ROW(id, type, song_id, title, notes, content, key_override, position, custom_arrangement,
                                   duration_minutes, phase, service_times)::text, '|' ORDER BY position, id)
               FROM plan_items WHERE plan_id = p.id), '') || '#' ||
   COALESCE((SELECT string_agg(ROW(id, name, role, user_id)::text, '|' ORDER BY id::text)
               FROM plan_musicians WHERE plan_id = p.id), ''));

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
