// Deep-copies a library song (row `t`) into another church: the song row, tags (matched by
// name), and — when the source has share_all_data — lyrics/notes/bible refs, files (real R2
// copies under the new church's own keys, so deleting one church's copy never touches the
// source) and videos/links.
//
// Used by POST /templates/:id/import (Discover / library import) and by the new-church
// sample content (utils/sampleContent.js). Keep it the ONE copy of this logic.
//
// Runs on the caller's client inside the caller's transaction. If the transaction rolls
// back, any R2 objects already copied are left orphaned, which is harmless.

const { CopyObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

async function copySongInto(client, t, churchId, { isSample = false } = {}) {
  const { r2, BUCKET } = require('../routes/uploads');

  const song = await client.query(
    `INSERT INTO songs (church_id, title, author, default_key, category, first_line, ccli_number,
      suggested_arrangement, time_signature, tempo,
      notes, bible_references, lyrics, copyright_info, copyright_link, is_template, is_sample)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,false,$16) RETURNING *`,
    [
      churchId, t.title, t.author, t.default_key, t.category, t.first_line, t.ccli_number,
      t.suggested_arrangement ?? null,
      t.time_signature ?? null,
      t.tempo ?? null,
      t.share_all_data ? t.notes : null,
      t.share_all_data ? t.bible_references : null,
      t.share_all_data ? t.lyrics : null,
      t.copyright_info ?? null,
      t.copyright_link ?? null,
      isSample,
    ]
  );
  const newSongId = song.rows[0].id;

  // Copy tags. Reuse an existing shared (global) or own-church tag by name —
  // preferring the shared default — and only create a church-owned tag when no
  // match exists. Mirrors the dedupe in POST /songs/tags/church so an import
  // never mints a private duplicate of a default-list tag.
  const templateTags = await client.query(
    `SELECT t.name FROM song_tags st JOIN tags t ON t.id = st.tag_id WHERE st.song_id = $1`,
    [t.id]
  );
  for (const tag of templateTags.rows) {
    const existingTag = await client.query(
      `SELECT id FROM tags
        WHERE (church_id IS NULL OR church_id = $1)
          AND lower(name) = lower($2)
        ORDER BY (church_id IS NOT NULL)
        LIMIT 1`,
      [churchId, tag.name]
    );
    let tagId;
    if (existingTag.rows.length) {
      tagId = existingTag.rows[0].id;
    } else {
      const newTag = await client.query(
        `INSERT INTO tags (church_id, name) VALUES ($1, $2)
         ON CONFLICT (church_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [churchId, tag.name]
      );
      tagId = newTag.rows[0].id;
    }
    await client.query(
      'INSERT INTO song_tags (song_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [newSongId, tagId]
    );
  }

  if (t.share_all_data) {
    // Song files: copy each R2 object to a new key owned by this church.
    const files = await client.query(`SELECT * FROM song_files WHERE song_id = $1`, [t.id]);
    for (const file of files.rows) {
      const ext = file.r2_key.split('.').pop();
      const newKey = `churches/${churchId}/songs/${newSongId}/${uuidv4()}.${ext}`;
      await r2.send(new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${file.r2_key}`,
        Key: newKey,
      }));
      await client.query(
        `INSERT INTO song_files (song_id, file_type, label, key_of, r2_key) VALUES ($1,$2,$3,$4,$5)`,
        [newSongId, file.file_type, file.label, file.key_of, newKey]
      );
    }

    // Videos / links.
    const videos = await client.query(
      `SELECT url, label, link_type, sort_order FROM song_videos WHERE song_id = $1`,
      [t.id]
    );
    for (const v of videos.rows) {
      await client.query(
        `INSERT INTO song_videos (song_id, url, label, link_type, sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [newSongId, v.url, v.label, v.link_type, v.sort_order]
      );
    }
  }

  return song.rows[0];
}

module.exports = { copySongInto };
