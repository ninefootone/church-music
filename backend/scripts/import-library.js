#!/usr/bin/env node

/**
 * Song Stack — Secondary Library Import Script
 *
 * Imports songs from a music-ministry.org CSV export into the master library
 * with is_draft = true, in_library = false, in_discover = false.
 *
 * Usage:
 *   node scripts/import-library.js --csv=songs.csv --dry-run
 *   node scripts/import-library.js --csv=songs.csv
 *
 * Required env vars in .env.import:
 *   DATABASE_URL         = your Railway DATABASE_PUBLIC_URL
 *   CHURCH_ID            = master library church UUID
 *   R2_ACCOUNT_ID        = Cloudflare account ID
 *   R2_ACCESS_KEY_ID     = R2 access key
 *   R2_SECRET_ACCESS_KEY = R2 secret key
 *   R2_BUCKET_NAME       = R2 bucket name
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

// --- Config ---

const DATABASE_URL         = process.env.DATABASE_URL;
const CHURCH_ID            = process.env.CHURCH_ID;
const R2_ACCOUNT_ID        = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID     = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME       = process.env.R2_BUCKET_NAME;

const DRY_RUN = process.argv.includes('--dry-run');
const CSV_ARG = process.argv.find(a => a.startsWith('--csv='));
const CSV_FILE = CSV_ARG ? CSV_ARG.split('=')[1] : null;

if (!CSV_FILE) { console.error('Error: provide --csv=filename.csv'); process.exit(1); }
if (!DATABASE_URL || !CHURCH_ID) { console.error('Error: DATABASE_URL and CHURCH_ID must be set'); process.exit(1); }
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('Error: R2 credentials must be set'); process.exit(1);
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

// --- Helpers ---

function splitPipe(val) {
  if (!val) return [];
  return val.split('|').map(s => s.trim()).filter(Boolean);
}

// Split "Author Name *© Copyright..." into { author, copyright }
function parseAuthorCopyright(raw) {
  if (!raw) return { author: null, copyright: null };
  const starIdx = raw.indexOf('*');
  if (starIdx === -1) return { author: raw.trim() || null, copyright: null };
  const author = raw.slice(0, starIdx).trim() || null;
  const copyright = raw.slice(starIdx + 1).trim() || null;
  return { author, copyright };
}

// Combine pipe-separated bible book + chapter into "Isaiah 49, Jeremiah 32"
function parseBibleRefs(bookCol, chapterCol) {
  const books = splitPipe(bookCol);
  const chapters = splitPipe(chapterCol);
  if (books.length === 0) return null;
  return books.map((b, i) => chapters[i] ? `${b} ${chapters[i]}` : b).join(', ');
}

function mapFileType(title = '') {
  const t = title.toLowerCase();
  if (t.includes('chord'))                         return 'chords';
  if (t.includes('lead'))                          return 'lead';
  if (t.includes('melody'))                        return 'lead';
  if (t.includes('vocal'))                         return 'vocal';
  if (t.includes('score') || t.includes('piano'))  return 'full_score';
  return 'other';
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, res => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || 'application/pdf' }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// --- DB helpers ---

async function findExistingSong(client, title) {
  const res = await client.query(
    `SELECT id FROM songs WHERE church_id = $1 AND LOWER(title) = LOWER($2)`,
    [CHURCH_ID, title.trim()]
  );
  return res.rows[0] || null;
}

async function createSong(client, data) {
  const res = await client.query(
    `INSERT INTO songs (
      church_id, title, author, default_key, first_line, lyrics,
      ccli_number, ccli_url, notes, bible_references, suggested_arrangement,
      copyright_info,
      is_draft, in_library, in_discover, share_all_data
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, true, false, false, false)
    RETURNING id`,
    [
      CHURCH_ID,
      data.title,
      data.author,
      data.default_key || null,
      data.first_line || null,
      data.lyrics || null,
      data.ccli_number || null,
      data.ccli_url || null,
      data.notes || null,
      data.bible_references || null,
      data.suggested_arrangement || null,
      data.copyright_info || null,
    ]
  );
  return res.rows[0];
}

async function addVideo(client, songId, url, label, sortOrder) {
  await client.query(
    `INSERT INTO song_videos (song_id, url, label, sort_order) VALUES ($1,$2,$3,$4)`,
    [songId, url, label || null, sortOrder]
  );
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
    `INSERT INTO song_files (song_id, file_type, label, key_of, r2_key) VALUES ($1,$2,$3,$4,$5)`,
    [songId, fileType, label || fileType, keyOf || null, r2Key]
  );
}

// --- Main ---

async function main() {
  console.log(`\nSong Stack Library Import ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log(`Reading: ${CSV_FILE}\n`);

  const raw = fs.readFileSync(CSV_FILE, 'utf-8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true });

  console.log(`Found ${rows.length} rows in CSV\n`);

  const client = await pool.connect();
  const results = { created: 0, skipped: 0, filesUploaded: 0, filesFailed: 0, errors: [] };

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const title = (row['Title'] || '').trim();
      if (!title) { results.skipped++; continue; }

      console.log(`[${i + 1}/${rows.length}] ${title}`);

      if (DRY_RUN) {
        const { author, copyright } = parseAuthorCopyright(row['Author']);
        console.log(`  author: ${author}, copyright: ${copyright}`);
        console.log(`  key: ${row['Suggested Key']}, ccli: ${row['CCLI#']}`);
        console.log(`  files: ${row['Downloads_song_file'] ? splitPipe(row['Downloads_song_file']).length : 0}`);
        results.created++;
        continue;
      }

      try {
        const existing = await findExistingSong(client, title);
        if (existing) {
          console.log(`  Skipping — already exists`);
          results.skipped++;
          continue;
        }

        const { author, copyright } = parseAuthorCopyright(row['Author']);

        // Use Content as lyrics (290 songs have it); fall back to Lyrics column
        const lyrics = row['Content'] || row['Lyrics'] || null;

        const bibleRefs = parseBibleRefs(
          row['Bible References_songs_ref_bible_book'],
          row['Bible References_songs_ref_bible_chapter']
        );

        const song = await createSong(client, {
          title,
          author,
          default_key:           (row['Suggested Key'] && row['Suggested Key'].trim() !== '—') ? row['Suggested Key'].trim() : null,
          first_line:            row['First Line'] || null,
          lyrics,
          ccli_number:           row['CCLI#'] ? row['CCLI#'].trim() || null : null,
          ccli_url:              row['Song Select Link'] || null,
          notes:                 row['Notes'] || null,
          bible_references:      bibleRefs,
          suggested_arrangement: row['Suggested Arrangement'] || null,
          copyright_info:        copyright,
        });

        console.log(`  Created ${song.id}`);
        results.created++;

        // Videos
        const vid1 = (row['Video 1 (YouTube URL)'] || '').trim();
        const vid2 = (row['Video 2 (YouTube URL)'] || '').trim();
        if (vid1) { await addVideo(client, song.id, vid1, 'YouTube', 0); console.log(`  Video 1`); }
        if (vid2) { await addVideo(client, song.id, vid2, 'YouTube 2', 1); console.log(`  Video 2`); }

        // Files
        const fileUrls   = splitPipe(row['Downloads_song_file']);
        const fileTitles = splitPipe(row['Downloads_song_download_title']);
        const fileKeys   = splitPipe(row['Downloads_song_download_key']);

        for (let f = 0; f < fileUrls.length; f++) {
          const url      = fileUrls[f];
          const label    = fileTitles[f] || '';
          const keyOf    = fileKeys[f] || row['Suggested Key'] || null;
          const fileType = mapFileType(label);
          const filename = path.basename(url.split('?')[0]);

          if (!url.match(/\.pdf$/i)) {
            console.log(`  Skipping non-PDF: ${filename}`);
            continue;
          }

          console.log(`  Downloading: ${filename}`);
          try {
            const { buffer, contentType } = await downloadFile(url);
            await uploadFileToR2(client, song.id, buffer, filename, contentType, fileType, label, keyOf);
            console.log(`  Uploaded: ${label || filename} (${fileType}, key: ${keyOf})`);
            results.filesUploaded++;
            await sleep(300);
          } catch (fileErr) {
            console.warn(`  File failed: ${filename} — ${fileErr.message}`);
            results.filesFailed++;
            results.errors.push({ song: title, file: filename, error: fileErr.message });
          }
        }

        await sleep(100);

      } catch (err) {
        console.error(`  ERROR: ${err.message}`);
        results.errors.push({ song: title, error: err.message });
        results.skipped++;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n---------------------------------');
  console.log(`Import complete ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log(`  Songs created:  ${results.created}`);
  console.log(`  Songs skipped:  ${results.skipped}`);
  console.log(`  Files uploaded: ${results.filesUploaded}`);
  console.log(`  Files failed:   ${results.filesFailed}`);
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(e => console.log(`  - ${e.song}: ${e.file ? e.file + ' — ' : ''}${e.error}`));
  }
  console.log('---------------------------------\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });