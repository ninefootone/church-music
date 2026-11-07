-- Rehearsal recordings (2026-11-07). Run in the Railway Data tab, not by a script.
-- Adds 'audio' as a song file type, plus file_size (for the per-church 500MB audio quota)
-- and uploaded_by (empties itself when the user deletes their account; the recording stays church content).
-- Applied to production 2026-11-07 and verified. See project doc claude/rehearsal-recordings.md.
BEGIN;
ALTER TABLE song_files DROP CONSTRAINT IF EXISTS song_files_file_type_check;
ALTER TABLE song_files ADD CONSTRAINT song_files_file_type_check
  CHECK (file_type IN ('chords','lead','vocal','full_score','other','chordpro','audio'));
ALTER TABLE song_files ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE song_files ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;
COMMIT;
