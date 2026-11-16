-- READ-ONLY. Exports Endcliffe Church's SongStack plans (yesterday → +7 weeks) as ONE JSON value,
-- for comparing with ChurchSuite (backend/scripts/churchsuite-compare.js). Changes nothing.
-- Paste into Railway → Postgres → Data tab, run, copy the single "export" cell into
-- backend/songstack-export.json (git-ignored).
SELECT json_build_object(
  'church', c.name,
  'exported_at', now(),
  'members', COALESCE((
    SELECT json_agg(u.name ORDER BY u.name)
      FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.church_id = c.id AND m.role <> 'revoked' AND u.name IS NOT NULL), '[]'::json),
  'plans', COALESCE((
    SELECT json_agg(json_build_object(
             'title', p.title,
             'date', to_char(p.plan_date, 'YYYY-MM-DD'),
             'start', to_char(p.plan_start_time, 'HH24:MI'),
             'extra', COALESCE((SELECT json_agg(to_char(t, 'HH24:MI')) FROM unnest(p.extra_times) t), '[]'::json),
             'status', p.status,
             'items', COALESCE((
               SELECT json_agg(json_build_object(
                        'type', pi.type, 'phase', pi.phase, 'title', pi.title,
                        'song', s.title, 'first_line', s.first_line, 'key', pi.key_override, 'default_key', s.default_key)
                      ORDER BY pi.position)
                 FROM plan_items pi LEFT JOIN songs s ON s.id = pi.song_id
                WHERE pi.plan_id = p.id), '[]'::json),
             'musicians', COALESCE((
               SELECT json_agg(json_build_object(
                        'name', COALESCE(NULLIF(pm.name, ''), u2.name), 'role', pm.role, 'linked', pm.user_id IS NOT NULL)
                      ORDER BY pm.created_at)
                 FROM plan_musicians pm LEFT JOIN users u2 ON u2.id = pm.user_id
                WHERE pm.plan_id = p.id), '[]'::json)
           ) ORDER BY p.plan_date, p.plan_start_time NULLS LAST)
      FROM plans p
     WHERE p.church_id = c.id
       AND p.plan_date BETWEEN CURRENT_DATE - 1 AND CURRENT_DATE + 49), '[]'::json)
)::text AS export
FROM churches c
WHERE c.name = 'Endcliffe Church';
