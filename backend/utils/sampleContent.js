// Sample content seeded into every NEW church (POST /churches) so the app isn't empty on
// day one: three master-library songs we have the artists' permission to give out, plus a
// draft sample plan that uses them. Everything is flagged is_sample = TRUE, so none of it
// counts towards the free-plan limits (utils/limits.js) and churches can delete it freely.
//
// Best-effort by design: called AFTER the church is committed, and it never throws. If the
// master library or R2 is unavailable the church is simply created without samples.
// Not run for invite-code joins, and not backfilled to existing churches.
// See project doc claude/sample-content.md.

const Sentry = require('@sentry/node');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { copySongInto } = require('./copySong');

// Master-library song IDs (Song Stack Library church). Order = order used in the plan.
// Changing these only affects churches created afterwards.
const SAMPLE_SONGS = [
  { id: 'bd2b32b1-4a38-43a6-96a5-9225a69b10aa', note: 'If Christ is mine — Joyful Noise' },
  { id: 'a28462f2-6c40-482e-9be4-9d35a3c96766', note: 'God Showed Us His Love — Awesome Cutlery' },
  { id: '509805fb-bfb7-43d0-b22b-3b5e96abfe30', note: 'Where, O Grave, Is Your Victory? — Ben Slee' },
];

const SAMPLE_PLAN_TITLE = 'Sample plan';

function report(err, churchId, step) {
  console.error(`[sampleContent] ${step} failed for church ${churchId}:`, err.message);
  Sentry.captureException(err, { tags: { area: 'sample-content', step }, extra: { churchId } });
}

// Copies one master song into the church in its own transaction. Returns the new song or null.
async function copySampleSong(sourceId, churchId) {
  const src = await pool.query(
    `SELECT * FROM songs
      WHERE id = $1 AND church_id = $2 AND in_library = TRUE
        AND (is_draft = FALSE OR is_draft IS NULL)
        AND (retired = FALSE OR retired IS NULL)`,
    [sourceId, process.env.MASTER_CHURCH_ID]
  );
  if (src.rows.length === 0) {
    console.warn(`[sampleContent] sample song ${sourceId} not found in the master library — skipped`);
    return null;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const song = await copySongInto(client, src.rows[0], churchId, { isSample: true });
    await client.query('COMMIT');
    return song;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function createSamplePlan(churchId, createdByClerkId, songs) {
  const [s1, s2, s3] = songs;
  const items = [
    { type: 'custom', title: 'Welcome',
      notes: "This is a sample plan to show you what's possible. It doesn't count towards your free plan limit — edit it, duplicate it or delete it whenever you like." },
    s1 && { type: 'song', song_id: s1.id },
    { type: 'custom', title: 'Prayer' },
    s2 && { type: 'song', song_id: s2.id },
    { type: 'custom', title: 'Reading', notes: '1 Corinthians 15:50–58' },
    { type: 'custom', title: 'Sermon' },
    s3 && { type: 'song', song_id: s3.id },
    { type: 'custom', title: 'Blessing' },
  ].filter(Boolean);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Dated the first Sunday at least 7 days away (7–13 days out), so it shows under
    // "Upcoming plans" on the dashboard for at least a week. Computed in SQL so the date
    // can't shift through a JS timezone conversion. Draft, so musicians who join by invite
    // don't see it as a real service.
    const plan = await client.query(
      `INSERT INTO plans (church_id, plan_date, plan_time, plan_start_time, plan_sort_order, title,
                          public_token, created_by, status, is_sample)
       VALUES ($1, CURRENT_DATE + (7 + (7 - EXTRACT(DOW FROM CURRENT_DATE)::int) % 7),
               '10:30 am', '10:30', 0, $2, $3, $4, 'draft', TRUE)
       RETURNING id`,
      [churchId, SAMPLE_PLAN_TITLE, uuidv4(), createdByClerkId]
    );
    const planId = plan.rows[0].id;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await client.query(
        `INSERT INTO plan_items (plan_id, type, song_id, title, notes, content, position, phase)
         VALUES ($1, $2, $3, $4, $5, NULL, $6, 'service')`,
        [planId, it.type, it.song_id || null, it.title || null, it.notes || null, i]
      );
    }
    await client.query('COMMIT');
    return planId;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Never throws. Returns { songs, plan } counts for logging.
async function seedSampleContent(churchId, createdByClerkId) {
  if (!process.env.MASTER_CHURCH_ID) {
    console.warn('[sampleContent] MASTER_CHURCH_ID not set — no sample content seeded');
    return { songs: 0, plan: false };
  }
  const copied = [];
  for (const s of SAMPLE_SONGS) {
    try {
      const song = await copySampleSong(s.id, churchId);
      if (song) copied.push(song);
    } catch (err) {
      report(err, churchId, `song ${s.id}`);
    }
  }
  if (copied.length === 0) return { songs: 0, plan: false };

  try {
    await createSamplePlan(churchId, createdByClerkId, copied);
    return { songs: copied.length, plan: true };
  } catch (err) {
    report(err, churchId, 'plan');
    return { songs: copied.length, plan: false };
  }
}

module.exports = { seedSampleContent, SAMPLE_SONGS };
