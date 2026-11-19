-- UNDO the most recent ChurchSuite sync run that changed anything. Paste into Railway → Postgres → Data tab
-- (Terminal: pbcopy < ~/church-music/backend/migrations/2026-11-17-churchsuite-undo-last-run.sql). Shows "no results" —
-- check the plans. Then removes that run from the log, so running this again undoes the run before it.
-- Puts back (2026-11-19 truth model): plans the run CREATED are deleted (only if nobody has edited them since);
-- items and musicians it REMOVED come back in full (notes included); positions; songs/items/musicians it added are
-- removed; keys, services, lengths and liturgy text it set are cleared/restored (only if unchanged since); plan times.
BEGIN;

CREATE TEMP TABLE undo_run ON COMMIT DROP AS
  SELECT * FROM churchsuite_sync_log
   WHERE run_id = (SELECT run_id FROM churchsuite_sync_log ORDER BY created_at DESC, id DESC LIMIT 1);

-- 0. Plans the run created, if unedited since. Fingerprint = PLAN_FINGERPRINT_SQL in churchsuite-sync.js.
DELETE FROM plans p USING undo_run u
 WHERE u.action = 'create_plan' AND p.id = u.plan_id AND u.detail->>'fp' = md5(
   COALESCE((SELECT string_agg(ROW(id, type, song_id, title, notes, content, key_override, position, custom_arrangement,
                                   duration_minutes, phase, service_times)::text, '|' ORDER BY position, id)
               FROM plan_items WHERE plan_id = p.id), '') || '#' ||
   COALESCE((SELECT string_agg(ROW(id, name, role, user_id)::text, '|' ORDER BY id::text)
               FROM plan_musicians WHERE plan_id = p.id), ''));

-- 1. Items the run removed — back in full (if their plan still exists).
INSERT INTO plan_items
SELECT (jsonb_populate_record(NULL::plan_items, u.detail->'row')).*
  FROM undo_run u
 WHERE u.action = 'remove_item' AND EXISTS (SELECT 1 FROM plans p WHERE p.id = u.plan_id)
   AND NOT EXISTS (SELECT 1 FROM plan_items pi WHERE pi.id = (u.detail->>'item_id')::uuid);

-- 2. Positions back to before the reorder.
UPDATE plan_items pi SET position = (b.value)::int
  FROM undo_run u, jsonb_each_text(u.detail->'before') b
 WHERE u.action = 'reorder' AND pi.id = (b.key)::uuid AND pi.plan_id = u.plan_id;

-- 3. Songs and items the run added.
DELETE FROM plan_items pi USING undo_run u
 WHERE u.action IN ('add_song', 'add_item') AND pi.id = (u.detail->>'item_id')::uuid AND pi.plan_id = u.plan_id;

-- 4. Keys the run filled in (left alone if someone has changed it since).
UPDATE plan_items pi SET key_override = NULL
  FROM undo_run u
 WHERE u.action = 'set_key' AND pi.id = (u.detail->>'item_id')::uuid AND pi.key_override = u.detail->>'key';

-- 5. Services the run set (put back, only if nobody has changed them since).
UPDATE plan_items pi SET service_times = ARRAY(SELECT jsonb_array_elements_text(u.detail->'before'))::time[]
  FROM undo_run u
 WHERE u.action = 'set_services' AND pi.id = (u.detail->>'item_id')::uuid AND pi.plan_id = u.plan_id
   AND pi.service_times = ARRAY(SELECT jsonb_array_elements_text(u.detail->'after'))::time[];

-- 6. Lengths and liturgy text the run filled in (only if unchanged since).
UPDATE plan_items pi SET duration_minutes = NULL
  FROM undo_run u
 WHERE u.action = 'set_item' AND u.detail->>'field' = 'duration_minutes' AND pi.id = (u.detail->>'item_id')::uuid
   AND pi.duration_minutes = (u.detail->>'after')::int;
UPDATE plan_items pi SET content = NULL
  FROM undo_run u
 WHERE u.action = 'set_item' AND u.detail->>'field' = 'content' AND pi.id = (u.detail->>'item_id')::uuid
   AND pi.content = u.detail->>'after';

-- 7. Musicians the run added / removed.
DELETE FROM plan_musicians pm USING undo_run u
 WHERE u.action = 'add_musician' AND pm.id = (u.detail->>'musician_id')::uuid AND pm.plan_id = u.plan_id;
INSERT INTO plan_musicians
SELECT (jsonb_populate_record(NULL::plan_musicians, u.detail->'row')).*
  FROM undo_run u
 WHERE u.action = 'remove_musician' AND EXISTS (SELECT 1 FROM plans p WHERE p.id = u.plan_id)
   AND NOT EXISTS (SELECT 1 FROM plan_musicians pm WHERE pm.id = (u.detail->>'musician_id')::uuid);

-- 8. Plan service times.
UPDATE plans p SET plan_start_time = (u.detail->'before'->>'plan_start_time')::time,
                   extra_times = ARRAY(SELECT jsonb_array_elements_text(u.detail->'before'->'extra_times'))::time[],
                   plan_time = u.detail->'before'->>'plan_time'
  FROM undo_run u
 WHERE u.action = 'set_plan_times' AND p.id = u.plan_id;

DELETE FROM churchsuite_sync_log WHERE run_id = (SELECT DISTINCT run_id FROM undo_run);

SELECT action, detail, created_at FROM undo_run ORDER BY id;   -- what was undone
COMMIT;
