#!/usr/bin/env node

/**
 * Song Stack — Awesome Cutlery Import Script
 *
 * Imports songs from an Awesome Cutlery CSV export into the master library.
 * - Downloads PDF files (Lead Sheet, Piano Music) and uploads to R2
 * - Stores YouTube links in song_videos table
 * - Skips hosted video files (.m4v, .mp4, .mov)
 * - Sets copyright_link = https://www.awesomecutlery.com/ for every song
 *
 * Usage:
 *   node scripts/import-awesomecutlery.js --csv=Tracks-Export.csv --dry-run
 *   node scripts/import-awesomecutlery.js --csv=Tracks-Export.csv
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
const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');
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

const COPYRIGHT_LINK = 'https://www.awesomecutlery.com/';

const DRY_RUN  = process.argv.includes('--dry-run');
const CSV_ARG  = process.argv.find(a => a.startsWith('--csv='));
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

function extractCcliNumber(raw) {
  if (!raw) return null;
  const m = raw.match(/\d{5,8}/);
  return m ? m[0] : null;
}

// "Copyright © 2016 Dan Adams and Gareth Loh" -> "Dan Adams and Gareth Loh"
function extractAuthor(copyrightRaw) {
  if (!copyrightRaw) return null;
  const m = copyrightRaw.match(/copyright\s*[©]\s*\d{4}\s+(.+)/i);
  if (m) return m[1].trim();
  return null;
}

function isYouTubeUrl(url) {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be');
}

function isPdfUrl(url) {
  if (!url) return false;
  return url.split('?')[0].toLowerCase().endsWith('.pdf');
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
      church_id, title, author, lyrics,
      ccli_number,
      copyright_info, copyright_link,
      is_draft, in_library, in_discover, share_all_data
    ) VALUES ($1,$2,$3,$4,$5,$6,$7, true, false, false, false)
    RETURNING id`,
    [
      CHURCH_ID,
      data.title,
      data.author         || null,
      data.lyrics         || null,
      data.ccli_number    || null,
      data.copyright_info || null,
      COPYRIGHT_LINK,
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

async function uploadFileToR2(client, songId, buffer, filename, contentType, fileType, label) {
  const ext = filename.split('.').pop() || 'pdf';
  const r2Key = `churches/${CHURCH_ID}/songs/${songId}/${uuidv4()}.${ext}`;
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: r2Key,
    Body: buffer,
    ContentType: contentType,
  }));
  await client.query(
    `INSERT INTO song_files (song_id, file_type, label, r2_key) VALUES ($1,$2,$3,$4)`,
    [songId, fileType, label || fileType, r2Key]
  );
}

// --- Main ---

async function main() {
  console.log(`\nSong Stack — Awesome Cutlery Import ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log(`Reading: ${CSV_FILE}\n`);

  const raw  = fs.readFileSync(CSV_FILE, 'utf-8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true });

  console.log(`Found ${rows.length} rows in CSV\n`);

  const client = await pool.connect();
  const results = { created: 0, skipped: 0, filesUploaded: 0, filesFailed: 0, videosAdded: 0, errors: [] };

  try {
    for (let i = 0; i < rows.length; i++) {
      const row   = rows[i];
      const title = (row['Title'] || '').trim();
      if (!title) { results.skipped++; continue; }

      console.log(`[${i + 1}/${rows.length}] ${title}`);

      const copyrightRaw = (row['Copyright info.'] || '').trim();
      const author       = extractAuthor(copyrightRaw);
      const ccliNumber   = extractCcliNumber(row['CCLI Details'] || '');
      const lyrics       = (row['Lyrics'] || '').trim() || null;

      if (DRY_RUN) {
        console.log(`  author: ${author}`);
        console.log(`  ccli: ${ccliNumber}`);
        console.log(`  copyright: ${copyrightRaw}`);
        const leadSheet  = (row['Lead Sheet']              || '').trim();
        const pianoMusic = (row['Piano Music']             || '').trim();
        const ytUrl      = (row['YouTube Player']          || '').trim();
        const howToPlay  = (row['How to play video link']  || '').trim();
        if (leadSheet)                        console.log(`  Lead Sheet PDF: ${leadSheet.slice(0, 80)}`);
        if (pianoMusic)                       console.log(`  Piano Music PDF: ${pianoMusic.slice(0, 80)}`);
        if (ytUrl     && isYouTubeUrl(ytUrl)) console.log(`  YouTube: ${ytUrl}`);
        if (howToPlay && isYouTubeUrl(howToPlay)) console.log(`  How to play: ${howToPlay}`);
        results.created++;
        continue;
      }

      try {
        const existing = await findExistingSong(client, title);
        if (existing) {
          console.log(`  Skipping — already exists (${existing.id})`);
          results.skipped++;
          continue;
        }

        const song = await createSong(client, {
          title,
          author,
          lyrics,
          ccli_number:    ccliNumber,
          copyright_info: copyrightRaw || null,
        });

        console.log(`  Created ${song.id}`);
        results.created++;

        // --- PDFs ---
        const pdfColumns = [
          { col: 'Lead Sheet',  fileType: 'lead',       label: 'Lead Sheet'  },
          { col: 'Piano Music', fileType: 'full_score', label: 'Piano Music' },
        ];

        for (const { col, fileType, label } of pdfColumns) {
          const url = (row[col] || '').trim();
          if (!url || !isPdfUrl(url)) continue;

          const filename = path.basename(url.split('?')[0]);
          console.log(`  Downloading ${label}: ${filename}`);
          try {
            const { buffer, contentType } = await downloadFile(url);
            await uploadFileToR2(client, song.id, buffer, filename, contentType, fileType, label);
            console.log(`  Uploaded: ${label}`);
            results.filesUploaded++;
            await sleep(300);
          } catch (fileErr) {
            console.warn(`  File failed: ${filename} — ${fileErr.message}`);
            results.filesFailed++;
            results.errors.push({ song: title, file: filename, error: fileErr.message });
          }
        }

        // --- YouTube links only (hosted video files skipped) ---
        let videoSort = 0;

        const ytPlayer = (row['YouTube Player'] || '').trim();
        if (ytPlayer && isYouTubeUrl(ytPlayer)) {
          await addVideo(client, song.id, ytPlayer, 'YouTube', videoSort++);
          console.log(`  Video: YouTube`);
          results.videosAdded++;
        }

        const howToPlay = (row['How to play video link'] || '').trim();
        if (howToPlay && isYouTubeUrl(howToPlay)) {
          await addVideo(client, song.id, howToPlay, 'How to play', videoSort++);
          console.log(`  Video: How to play`);
          results.videosAdded++;
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
  console.log(`  Videos added:   ${results.videosAdded}`);
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(e => console.log(`  - ${e.song}: ${e.file ? e.file + ' — ' : ''}${e.error}`));
  }
  console.log('---------------------------------\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });