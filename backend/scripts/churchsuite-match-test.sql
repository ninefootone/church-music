-- READ-ONLY. ChurchSuite → SongStack title-match test (Endcliffe Church). Changes nothing.
-- Paste into Railway → Postgres → Data tab. Titles = distinct songs from the ChurchSuite trial
-- (churchsuite-snapshot.json, 2026-11-16: 9 plans, next 6 weeks).
WITH cs(title) AS (VALUES
  ('All Creatures of Our God and King'), ('All Praise to Him'), ('All Through History'),
  ('Behold the Lamb who takes our sins away'), ('Come Behold the Wondrous Mystery'),
  ('Come People of the Risen King'), ('Gentle and Lowly'), ('He Will Be'), ('He Will Hold Me Fast'),
  ('His Mercy Is More'), ('Jesus The Name High Over All'), ('Let love be found among us'),
  ('Man of Sorrows (Oh, That Rugged Cross)'), ('No one is good (Mighty, mighty saviour)'),
  ('Only a holy God (Who else commands)'), ('Rock of Ages'), ('See Him coming (Glory and Power)'),
  ('See amid the winter''s snow'), ('So Great Is Jesus'' Love'), ('Sovereign One'),
  ('There is a Hope'), ('We Are the Church')
),
lib AS (
  SELECT s.id, s.title, s.first_line, COALESCE(s.retired, FALSE) AS retired
  FROM songs s JOIN churches c ON c.id = s.church_id
  WHERE c.name = 'Endcliffe Church'
),
-- Each title in up to three forms: full, the part before "(", the part inside "( )"
cs_v AS (
  SELECT cs.title, x.v
  FROM cs, LATERAL (VALUES (cs.title), (split_part(cs.title, ' (', 1)), (substring(cs.title FROM '\((.*)\)'))) x(v)
  WHERE x.v IS NOT NULL AND x.v <> ''
),
lib_v AS (
  SELECT lib.id, lib.title, lib.retired, x.v, x.kind
  FROM lib, LATERAL (VALUES (lib.title, 'title'), (split_part(lib.title, ' (', 1), 'title'),
                            (substring(lib.title FROM '\((.*)\)'), 'title'), (lib.first_line, 'first line')) x(v, kind)
  WHERE x.v IS NOT NULL AND x.v <> ''
),
-- Normalise: lower case, drop apostrophes, anything that isn't a letter/number becomes a space
n_cs AS (SELECT title, trim(regexp_replace(lower(translate(v, '''’‘`', '')), '[^a-z0-9]+', ' ', 'g')) AS n FROM cs_v),
n_lib AS (SELECT id, title, retired, kind, trim(regexp_replace(lower(translate(v, '''’‘`', '')), '[^a-z0-9]+', ' ', 'g')) AS n FROM lib_v),
full_cs AS (SELECT title, trim(regexp_replace(lower(translate(title, '''’‘`', '')), '[^a-z0-9]+', ' ', 'g')) AS n FROM cs),
full_lib AS (SELECT id, title, retired, trim(regexp_replace(lower(translate(title, '''’‘`', '')), '[^a-z0-9]+', ' ', 'g')) AS n FROM lib),
candidates AS (
  SELECT f.title AS cs_title, l.title AS songstack_title, l.retired, 1 AS rank, 'exact' AS result
    FROM full_cs f JOIN full_lib l ON l.n = f.n
  UNION ALL
  SELECT c.title, l.title, l.retired, CASE WHEN l.kind = 'title' THEN 2 ELSE 3 END,
         CASE WHEN l.kind = 'title' THEN 'alt title' ELSE 'first line' END
    FROM n_cs c JOIN n_lib l ON l.n = c.n
  UNION ALL
  -- Partial: one title starts with the other (e.g. extra words) — needs a human check
  SELECT f.title, l.title, l.retired, 4, 'partial — check'
    FROM full_cs f JOIN full_lib l
      ON length(f.n) >= 8 AND length(l.n) >= 8 AND (l.n LIKE f.n || ' %' OR f.n LIKE l.n || ' %')
)
SELECT cs.title AS churchsuite_title,
       COALESCE(best.result, 'NO MATCH') AS result,
       best.songstack_title || CASE WHEN best.retired THEN ' [retired]' ELSE '' END AS songstack_song,
       (SELECT count(*) FROM lib) AS library_size
FROM cs
LEFT JOIN LATERAL (
  SELECT * FROM candidates WHERE candidates.cs_title = cs.title ORDER BY rank, songstack_title LIMIT 1
) best ON TRUE
ORDER BY COALESCE(best.rank, 9), cs.title;
