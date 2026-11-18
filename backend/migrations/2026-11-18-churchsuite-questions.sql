-- ChurchSuite sync, item 3 (2026-11-18): confirm-once matches + questions for admins.
-- See project doc churchsuite-integration.md. Safe to run more than once.

-- "ChurchSuite person X is …" — remembered per church. cs_key = '<type>:<ChurchSuite id>'
-- (e.g. 'addressbook_contact:123'), so a later name change in ChurchSuite doesn't matter.
CREATE TABLE IF NOT EXISTS churchsuite_people (
  church_id  UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  cs_key     TEXT NOT NULL,
  cs_name    TEXT NOT NULL,
  decision   TEXT NOT NULL CHECK (decision IN ('member', 'name_only', 'ignore')),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,   -- set when decision = 'member'
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (church_id, cs_key),
  CHECK (decision <> 'member' OR user_id IS NOT NULL)
);

-- "ChurchSuite song item X is our song Y" — cs_key = 'lib:<library item id>' or 'song:<Songs-module song id>'.
CREATE TABLE IF NOT EXISTS churchsuite_songs (
  church_id  UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  cs_key     TEXT NOT NULL,
  cs_title   TEXT NOT NULL,
  decision   TEXT NOT NULL CHECK (decision IN ('song', 'ignore')),
  song_id    UUID REFERENCES songs(id) ON DELETE CASCADE,   -- set when decision = 'song'
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (church_id, cs_key),
  CHECK (decision <> 'song' OR song_id IS NOT NULL)
);

-- Questions the sync couldn't answer on its own, shown on Settings → ChurchSuite.
-- kind: person | song | removed_song | removed_musician. One row per (church, kind, q_key); the sync re-opens or
-- refreshes it each run, and marks open questions it no longer sees as 'gone'.
CREATE TABLE IF NOT EXISTS churchsuite_questions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id   UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('person', 'song', 'removed_song', 'removed_musician')),
  q_key       TEXT NOT NULL,
  plan_id     UUID REFERENCES plans(id) ON DELETE CASCADE,
  plan_date   DATE,
  payload     JSONB NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'gone')),
  answer      TEXT,
  answered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  answered_at TIMESTAMPTZ,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (church_id, kind, q_key)
);
CREATE INDEX IF NOT EXISTS churchsuite_questions_open_idx ON churchsuite_questions (church_id, status);

-- Check: should list the three tables.
SELECT table_name FROM information_schema.tables
 WHERE table_name IN ('churchsuite_people', 'churchsuite_songs', 'churchsuite_questions') ORDER BY table_name;
