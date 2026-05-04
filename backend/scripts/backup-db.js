require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { Pool } = require('pg');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { createGzip } = require('zlib');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
const R2_ENDPOINT  = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_BUCKET    = process.env.BACKUP_R2_BUCKET || 'church-music-backups';
const R2_PREFIX    = process.env.BACKUP_R2_PREFIX || 'db-backups/';
const KEEP_BACKUPS = parseInt(process.env.BACKUP_KEEP_COUNT || '14', 10);

if (!DATABASE_URL)            { console.error('DATABASE_URL is not set');  process.exit(1); }
if (!process.env.R2_ACCOUNT_ID) { console.error('R2_ACCOUNT_ID is not set'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function dumpTable(client, tableName, write) {
  // Check if created_at exists before trying to order by it
  const { rows: cols } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'created_at'`,
    [tableName]
  );
  const hasCreatedAt = cols.length > 0;
  const { rows } = await client.query(
    `SELECT * FROM "${tableName}"${hasCreatedAt ? ' ORDER BY created_at ASC NULLS FIRST' : ''}`
  );
  if (rows.length === 0) return;

  write(`\n-- Table: ${tableName} (${rows.length} rows)\n`);

  for (const row of rows) {
    const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
    const vals = Object.values(row).map(escapeValue).join(', ');
    write(`INSERT INTO "${tableName}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`);
  }
}

async function pruneOldBackups() {
  const list = await s3.send(new ListObjectsV2Command({
    Bucket: R2_BUCKET,
    Prefix: R2_PREFIX,
  }));
  if (!list.Contents || list.Contents.length === 0) return;

  const sorted = list.Contents
    .filter(o => o.Key.endsWith('.sql.gz'))
    .sort((a, b) => new Date(a.LastModified) - new Date(b.LastModified));

  const toDelete = sorted.slice(0, Math.max(0, sorted.length - KEEP_BACKUPS));
  for (const obj of toDelete) {
    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: obj.Key }));
    console.log(`Deleted old backup: ${obj.Key}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const filename = `backup_${timestamp()}.sql.gz`;
  const r2Key    = `${R2_PREFIX}${filename}`;

  console.log(`Starting backup → ${filename}`);

  const client = await pool.connect();

  try {
    // Get all user tables in dependency order
    const { rows: tables } = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    // Build SQL in memory
    const chunks = [];
    const write = (str) => chunks.push(str);

    write(`-- Song Stack DB Backup\n-- Generated: ${new Date().toISOString()}\n`);
    write(`-- Tables: ${tables.map(t => t.tablename).join(', ')}\n\n`);
    write(`SET session_replication_role = replica; -- disable FK checks during restore\n`);

    for (const { tablename } of tables) {
      console.log(`  Dumping: ${tablename}`);
      await dumpTable(client, tablename, write);
    }

    write(`\nSET session_replication_role = DEFAULT;\n`);
    write(`-- Backup complete\n`);

    // Gzip the buffer
    const sqlBuffer = Buffer.from(chunks.join(''), 'utf8');
    const gzipped = await new Promise((resolve, reject) => {
      const gzip = createGzip();
      const buffers = [];
      gzip.on('data', d => buffers.push(d));
      gzip.on('end', () => resolve(Buffer.concat(buffers)));
      gzip.on('error', reject);
      gzip.write(sqlBuffer);
      gzip.end();
    });

    console.log(`SQL: ${(sqlBuffer.length / 1024).toFixed(1)}KB → gzipped: ${(gzipped.length / 1024).toFixed(1)}KB`);

    await s3.send(new PutObjectCommand({
      Bucket:        R2_BUCKET,
      Key:           r2Key,
      Body:          gzipped,
      ContentType:   'application/gzip',
      ContentLength: gzipped.length,
    }));

    console.log(`Uploaded → s3://${R2_BUCKET}/${r2Key}`);
    await pruneOldBackups();
    console.log('Backup complete ✓');

  } catch (err) {
    console.error('Backup failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();