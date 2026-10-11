// Loads Claude's rights research (tagging-work/rights.json → { songId: { rights_status, rights_note } })
// into master-library songs. Run AFTER migrations/add-song-rights-and-favourites.js.
//  - Only fills songs whose rights_status is still NULL, so edits made on /library-tagging are never
//    overwritten. Pass --overwrite to replace everything from the file.
//  - --set-copyright: for public_domain songs whose copyright_info is EMPTY, also write
//    "Public domain (words and music)". Never touches a copyright_info that already has text.
//  - Never sets files_cleared — that is a manual decision after opening the files.
//  - Always writes tagging-work/rights-dbcheck.json (title, status, current copyright_info, file labels)
//    so Claude can cross-check against what Music Ministry's import put in copyright_info.
//    tagging-work/ is gitignored — never commit it.
//
// Usage (dry run first):
//   cd ~/church-music/backend && DATABASE_URL='…' MASTER_CHURCH_ID='…' node scripts/import-rights.js --dry-run
//   cd ~/church-music/backend && DATABASE_URL='…' MASTER_CHURCH_ID='…' node scripts/import-rights.js --set-copyright

require('dotenv').config({ path: '.env.import' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL || !process.env.MASTER_CHURCH_ID) {
  console.error('DATABASE_URL and MASTER_CHURCH_ID must both be set inline (see claude/running-backend-scripts.md).');
  process.exit(1);
}
const DRY = process.argv.includes('--dry-run');
const OVERWRITE = process.argv.includes('--overwrite');
const SET_COPYRIGHT = process.argv.includes('--set-copyright');
const PD_TEXT = 'Public domain (words and music)';
const VALID = new Set(['public_domain', 'pd_words', 'mm_owned', 'partner', 'copyright', 'unknown']);

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: isLocal ? false : { rejectUnauthorized: false } });
const WORK = path.join(__dirname, '..', '..', 'tagging-work');

async function run() {
  const research = JSON.parse(fs.readFileSync(path.join(WORK, 'rights.json'), 'utf8'));
  const client = await pool.connect();
  const counts = { updated: 0, skippedAlreadySet: 0, copyrightTextSet: 0, notInFile: 0, badStatus: 0 };
  try {
    const { rows: songs } = await client.query(
      `SELECT s.id, s.title, s.author, s.rights_status, s.copyright_info, s.is_draft, s.in_library,
              s.in_discover, s.share_all_data,
              COALESCE((SELECT json_agg(json_build_object('type', f.file_type, 'label', f.label, 'filename', f.filename))
                          FROM song_files f WHERE f.song_id = s.id), '[]') AS files
         FROM songs s
        WHERE s.church_id = $1 AND (s.retired = false OR s.retired IS NULL)
        ORDER BY lower(s.title)`,
      [process.env.MASTER_CHURCH_ID]
    );

    await client.query('BEGIN');
    const check = [];
    const notInFile = [];
    for (const s of songs) {
      const r = research[s.id];
      if (!r) { counts.notInFile++; notInFile.push(s.title); continue; }
      if (!VALID.has(r.rights_status)) { counts.badStatus++; continue; }
      // A status already set in the DB (e.g. edited on /library-tagging) wins unless --overwrite.
      const keepDb = s.rights_status && !OVERWRITE;
      const effective = keepDb ? s.rights_status : r.rights_status;
      check.push({ id: s.id, title: s.title, author: s.author, status: effective,
        copyright_info: s.copyright_info, is_draft: s.is_draft, in_library: s.in_library,
        in_discover: s.in_discover, share_all_data: s.share_all_data, files: s.files });

      if (keepDb) { counts.skippedAlreadySet++; }
      else {
        counts.updated++;
        if (!DRY) {
          await client.query('UPDATE songs SET rights_status = $1, rights_note = $2 WHERE id = $3',
            [r.rights_status, r.rights_note, s.id]);
        }
      }
      if (SET_COPYRIGHT && effective === 'public_domain' && !(s.copyright_info || '').trim()) {
        counts.copyrightTextSet++;
        if (!DRY) await client.query('UPDATE songs SET copyright_info = $1 WHERE id = $2', [PD_TEXT, s.id]);
      }
    }
    if (DRY) await client.query('ROLLBACK'); else await client.query('COMMIT');

    fs.writeFileSync(path.join(WORK, 'rights-dbcheck.json'), JSON.stringify(check, null, 1));
    console.log(`${DRY ? '(DRY RUN — nothing written) ' : ''}${songs.length} master songs checked`);
    console.log(`  rights set:                 ${counts.updated}`);
    console.log(`  skipped (already set):      ${counts.skippedAlreadySet}${OVERWRITE ? '' : '  (use --overwrite to replace)'}`);
    console.log(`  copyright text added (PD):  ${counts.copyrightTextSet}${SET_COPYRIGHT ? '' : '  (only with --set-copyright)'}`);
    console.log(`  not in rights.json:         ${counts.notInFile}${notInFile.length ? ' → ' + notInFile.join('; ') : ''}`);
    if (counts.badStatus) console.log(`  invalid status in file:     ${counts.badStatus}`);
    console.log('  wrote tagging-work/rights-dbcheck.json (send it back to Claude for the cross-check)');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Import failed (rolled back):', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
