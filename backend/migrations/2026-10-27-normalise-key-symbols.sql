-- 2026-10-27: store keys in the dropdown spelling ('E♭' → 'Eb', 'F♯' → 'F#', spaces removed).
-- Library-imported / Discover-copied files had ♭/♯, so files in a song's own key showed under
-- "Other keys". All churches. Run in Railway → Postgres → Data. Safe to re-run.
BEGIN;
UPDATE songs SET default_key = NULLIF(regexp_replace(translate(default_key, '♯♭', '#b'), '\s', '', 'g'), '')
 WHERE default_key IS DISTINCT FROM NULLIF(regexp_replace(translate(default_key, '♯♭', '#b'), '\s', '', 'g'), '');
UPDATE song_files SET key_of = NULLIF(regexp_replace(translate(key_of, '♯♭', '#b'), '\s', '', 'g'), '')
 WHERE key_of IS DISTINCT FROM NULLIF(regexp_replace(translate(key_of, '♯♭', '#b'), '\s', '', 'g'), '');
UPDATE ccli_lookup SET default_key = NULLIF(regexp_replace(translate(default_key, '♯♭', '#b'), '\s', '', 'g'), '')
 WHERE default_key IS DISTINCT FROM NULLIF(regexp_replace(translate(default_key, '♯♭', '#b'), '\s', '', 'g'), '');
UPDATE plan_items SET key_override = NULLIF(regexp_replace(translate(key_override, '♯♭', '#b'), '\s', '', 'g'), '')
 WHERE key_override IS DISTINCT FROM NULLIF(regexp_replace(translate(key_override, '♯♭', '#b'), '\s', '', 'g'), '');
COMMIT;
