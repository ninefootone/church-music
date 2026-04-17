#!/usr/bin/env node

/**
 * Song Stack — WordPress Import Script (Direct DB + Direct R2 version)
 *
 * Reads a WP All Export CSV and imports songs + PDFs directly into Postgres
 * and R2, bypassing the API entirely — no Clerk token needed.
 *
 * Usage:
 *   node scripts/import-songs.js --csv=songs.csv --dry-run
 *   node scripts/import-songs.js --csv=songs.csv
 *   node scripts/import-songs.js --csv=songs.csv --files-only
 *
 * --files-only: skip song/tag/video creation, only upload missing PDFs
 *
 * Required env vars in .env.import:
 *   DATABASE_URL        = your Railway DATABASE_PUBLIC_URL
 *   CHURCH_ID           = your church UUID
 *   R2_ACCOUNT_ID       = Cloudflare account ID
 *   R2_ACCESS_KEY_ID    = R2 access key
 *   R2_SECRET_ACCESS_KEY = R2 secret key
 *   R2_BUCKET_NAME      = R2 bucket name
 */

require('dotenv').config({ path: '.env.import' });
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { parse } = require('csv-parse/sync');
const { Pool } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// --- Config ---

const DATABASE_URL        = process.env.DATABASE_URL;
const CHURCH_ID           = process.env.CHURCH_ID;
const R2_ACCOUNT_ID       = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID    = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME      = process.env.R2_BUCKET_NAME;

const DRY_RUN    = process.argv.includes('--dry-run');
const FILES_ONLY = process.argv.includes('--files-only');
const CSV_ARG    = process.argv.find(a => a.startsWith('--csv='));
const CSV_FILE   = CSV_ARG ? CSV_ARG.split('=')[1] : null;

if (!CSV_FILE) {
  console.error('Error: provide --csv=filename.csv');
  process.exit(1);
}
if (!DATABASE_URL || !CHURCH_ID) {
  console.error('Error: DATABASE_URL and CHURCH_ID must be set in .env.import');
  process.exit(1);
}
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('Error: R2 credentials must be set in .env.import');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// --- File type mapping ---

function mapFileType(title = '') {
  const t = title.toLowerCase();
  if (t.includes('chord'))                          return 'chords';
  if (t.includes('lead'))                           return 'lead';
  if (t.includes('melody'))                         return 'lead';
  if (t.includes('vocal'))                          return 'vocal';
  if (t.includes('score') || t.includes('piano'))   return 'full_score';
  if (t.includes('complete') || t.includes('all'))  return 'full_score';
  return 'other';
}

function mapPartsFileType(title = '') {
  const t = title.toLowerCase();
  if (t.includes('guitar')) return 'chords';
  return 'vocal';
}

// --- Helpers ---

function splitPipe(val) {
  if (!val) return [];
  return val.split('|').map(s => s.trim()).filter(Boolean);
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: res.headers['content-type'] || 'application/pdf',
      }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// --- DB helpers ---

async function findExistingSong(client, title) {
  const res = await client.query(
    `SELECT id FROM songs WHERE church_id = $1 AND LOWER(title) = LOWER($2)`,
    [CHURCH_ID, title.trim()]
  );
  return res.rows[0] || null;
}

async function createSongDB(client, data) {
  const res = await client.query(
    `INSERT INTO songs (
      church_id, title, author, default_key, first_line, lyrics,
      ccli_number, ccli_url, youtube_url, notes, bible_references,
      suggested_arrangement
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *`,
    [
      CHURCH_ID,
      data.title || null,
      data.author || null,
      data.default_key || null,
      data.first_line || null,
      data.lyrics || null,
      data.ccli_number || null,
      data.ccli_url || null,
      data.youtube_url || null,
      data.notes || null,
      data.bible_references || null,
      data.suggested_arrangement || null,
    ]
  );
  return res.rows[0];
}

async function addTagsDB(client, songId, tags) {
  for (const tagName of tags) {
    const tagRes = await client.query(
      `INSERT INTO tags (church_id, name) VALUES ($1, $2)
       ON CONFLICT (church_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [CHURCH_ID, tagName]
    );
    const tagId = tagRes.rows[0].id;
    await client.query(
      `INSERT INTO song_tags (song_id, tag_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [songId, tagId]
    );
  }
}

async function addVideoDB(client, songId, url, label, sortOrder) {
  await client.query(
    `INSERT INTO song_videos (song_id, url, label, sort_order)
     VALUES ($1, $2, $3, $4)`,
    [songId, url, label || null, sortOrder || 0]
  );
}

async function songHasFiles(client, songId) {
  const res = await client.query(
    `SELECT COUNT(*) FROM song_files WHERE song_id = $1`,
    [songId]
  );
  return parseInt(res.rows[0].count) > 0;
}

async function uploadFileToR2(client, songId, buffer, filename, contentType, fileType, label, keyOf) {
  const ext = filename.split('.').pop() || 'pdf';
  const r2Key = `churches/${CHURCH_ID}/songs/${songId}/${uuidv4()}.${ext}`;

  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: r2Key,
    Body: buffer,
    ContentType: contentType,
  }));

  await client.query(
    `INSERT INTO song_files (song_id, file_type, label, key_of, r2_key)
     VALUES ($1, $2, $3, $4, $5)`,
    [songId, fileType, label || fileType, keyOf || null, r2Key]
  );
}

// --- Main ---

async function main() {
  console.log(`\nSong Stack Import ${DRY_RUN ? '(DRY RUN)' : ''}${FILES_ONLY ? '(FILES ONLY)' : ''}`);
  console.log(`Reading: ${CSV_FILE}\n`);

  const raw = fs.readFileSync(CSV_FILE, 'utf-8');
  const rawRows = parse(raw, { skip_empty_lines: true, relax_column_count: true });
  const headerRow = rawRows[0];
  const TITLE_COL = 1;

  const rows = rawRows.slice(1).map(r => {
    const obj = {};
    headerRow.forEach((h, i) => { obj[h] = r[i]; });
    obj['Title'] = r[TITLE_COL];
    return obj;
  });

  console.log(`Found ${rows.length} songs in CSV\n`);

  const client = await pool.connect();
  const results = { created: 0, skipped: 0, filesUploaded: 0, errors: [] };

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const title = (row['Title'] || '').trim();

      if (!title) {
        results.skipped++;
        continue;
      }

      console.log(`[${i + 1}/${rows.length}] ${title}`);

      if (DRY_RUN) {
        console.log(`  -> Would process: ${title}`);
        results.created++;
        continue;
      }

      try {
        let songId;

        if (!FILES_ONLY) {
          // Duplicate check
          const existing = await findExistingSong(client, title);
          if (existing) {
            console.log(`  Skipping song -- already exists`);
            songId = existing.id;
          } else {
            // Create song
            const song = await createSongDB(client, {
              title,
              author:                row['Composer / Artist'] || null,
              default_key:           row['Suggested Key'] || null,
              first_line:            row['First Line'] || null,
              lyrics:                row['Lyrics'] || null,
              ccli_number:           row['CCLI#'] || null,
              ccli_url:              row['Song Select Link'] || null,
              notes:                 row['Notes'] || null,
              bible_references:      row['Bible References'] || null,
              suggested_arrangement: row['Suggested arrangement'] || null,
            });
            songId = song.id;
            console.log(`  Created song ${songId}`);
            results.created++;

            // Tags
            const tags = splitPipe(row['Tags']);
            if (tags.length > 0) {
              await addTagsDB(client, songId, tags);
              console.log(`  Tags: ${tags.join(', ')}`);
            }

            // Videos
            const video1 = (row['Video 1 URL (YouTube)'] || '').trim();
            const video2 = (row['Video 2 URL (YouTube)'] || '').trim();
            if (video1) {
              await addVideoDB(client, songId, video1, 'Video 1', 0);
              console.log(`  Video 1`);
            }
            if (video2) {
              await addVideoDB(client, songId, video2, 'Video 2', 1);
              console.log(`  Video 2`);
            }
          }
        } else {
          // Files only mode — look up existing song
          const existing = await findExistingSong(client, title);
          if (!existing) {
            console.log(`  Song not found in DB — skipping`);
            results.skipped++;
            continue;
          }
          songId = existing.id;
        }

        // PDFs — skip if song already has files
        const alreadyHasFiles = await songHasFiles(client, songId);
        if (alreadyHasFiles) {
          console.log(`  Files already uploaded — skipping`);
          continue;
        }

        const pdfUrls   = splitPipe(row['Downloads (main key)_song_download_main_key_file']);
        const pdfTitles = splitPipe(row['Downloads (main key)_song_download_main_key_title']);
        const songKey   = row['Suggested Key'] || null;

        for (let p = 0; p < pdfUrls.length; p++) {
          const pdfUrl   = pdfUrls[p];
          const pdfTitle = pdfTitles[p] || '';

          if (!pdfUrl.match(/\.pdf$/i)) {
            console.log(`  Skipping non-PDF: ${path.basename(pdfUrl)}`);
            continue;
          }

          const fileType = mapFileType(pdfTitle);
          const filename = path.basename(pdfUrl.split('?')[0]);

          console.log(`  Downloading: ${filename}`);
          try {
            const { buffer, contentType } = await downloadFile(pdfUrl);
            await uploadFileToR2(client, songId, buffer, filename, contentType, fileType, pdfTitle, songKey);
            console.log(`  Uploaded to R2: ${pdfTitle || filename} (${fileType})`);
            results.filesUploaded++;
            await sleep(200);
          } catch (fileErr) {
            console.warn(`  File failed: ${filename} -- ${fileErr.message}`);
            results.errors.push({ song: title, file: filename, error: fileErr.message });
          }
        }

        await sleep(100);

      // Parts files (alternate keys / instruments)
        const partsTitles  = splitPipe(row['Parts_song_parts_title']);
        const partsKeys    = splitPipe(row['Parts_song_parts_key']);
        const partsUrls    = splitPipe(row['Parts_song_parts_download']);

        for (let p = 0; p < partsUrls.length; p++) {
          const pdfUrl   = partsUrls[p];
          const pdfTitle = partsTitles[p] || '';
          const pdfKey   = partsKeys[p] || null;

          if (!pdfUrl.match(/\.pdf$/i)) {
            console.log(`  Skipping non-PDF part: ${path.basename(pdfUrl)}`);
            continue;
          }

          const fileType = mapPartsFileType(pdfTitle);
          const filename = path.basename(pdfUrl.split('?')[0]);

          console.log(`  Downloading part: ${filename}`);
          try {
            const { buffer, contentType } = await downloadFile(pdfUrl);
            await uploadFileToR2(client, songId, buffer, filename, contentType, fileType, pdfTitle, pdfKey);
            console.log(`  Uploaded part: ${pdfTitle || filename} (${fileType}, key: ${pdfKey})`);
            results.filesUploaded++;
            await sleep(200);
          } catch (fileErr) {
            console.warn(`  Part failed: ${filename} -- ${fileErr.message}`);
            results.errors.push({ song: title, file: filename, error: fileErr.message });
          }
        }
  

      } catch (err) {
        console.error(`  Failed: ${err.message}`);
        results.errors.push({ song: title, error: err.message });
        results.skipped++;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n---------------------------------');
  console.log(`Import complete ${DRY_RUN ? '(DRY RUN)' : ''}${FILES_ONLY ? '(FILES ONLY)' : ''}`);
  console.log(`  Songs created:  ${results.created}`);
  console.log(`  Songs skipped:  ${results.skipped}`);
  console.log(`  Files uploaded: ${results.filesUploaded}`);
  console.log(`  Errors:         ${results.errors.length}`);
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(e => console.log(`  - ${e.song}: ${e.error}`));
  }
  console.log('---------------------------------\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
