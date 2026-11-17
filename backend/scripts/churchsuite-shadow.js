// Scheduled ChurchSuite → SongStack job for ONE church (Railway cron).
//   CS_SYNC_MODE unset / 'report' → READ-ONLY: works out what a sync would do (and previews it), changes nothing.
//   CS_SYNC_MODE = 'apply'        → runs the minimal sync (lib/churchsuite-sync.js), logging every change to
//                                   churchsuite_sync_log so a run can be undone.
// Then compares ChurchSuite with SongStack and emails when the report has changed since the last run (kept in
// churchsuite_shadow_reports) — or, in apply mode, whenever the sync changed something.
//
// Runs as a Railway cron service (see project doc churchsuite-integration.md). Env:
//   DATABASE_URL       ${{Postgres.DATABASE_URL}} (private network)
//   CS_CLIENT_ID / CS_CLIENT_SECRET   the church's ChurchSuite API user
//   CS_SHADOW_CHURCH   SongStack church name, e.g. Endcliffe Church
//   CS_SHADOW_EMAIL    who gets the report
//   BREVO_API_KEY      same as the backend
//   CS_SYNC_MODE       'apply' to let the sync change plans; anything else = report only
// Local test (prints only, saves/sends nothing, never applies):  node scripts/churchsuite-shadow.js --dry

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const { createClient } = require('./lib/churchsuite');
const { buildReport } = require('./lib/churchsuite-report');
const { applySync, formatSync } = require('./lib/churchsuite-sync');
const { sendBrevoEmail, escapeHtml } = require('../utils/email');

const DRY = process.argv.includes('--dry');
const APPLY = !DRY && process.env.CS_SYNC_MODE === 'apply';
const { DATABASE_URL, CS_CLIENT_ID, CS_CLIENT_SECRET, CS_SHADOW_CHURCH, CS_SHADOW_EMAIL } = process.env;
for (const [k, v] of Object.entries({ DATABASE_URL, CS_CLIENT_ID, CS_CLIENT_SECRET, CS_SHADOW_CHURCH })) {
  if (!v) { console.error(`${k} is not set — aborting.`); process.exit(1); }
}
if (!DRY && (!CS_SHADOW_EMAIL || !process.env.BREVO_API_KEY)) { console.error('CS_SHADOW_EMAIL / BREVO_API_KEY not set — aborting.'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 10000 });
const ymd = d => d.toISOString().slice(0, 10);

// Same query as the Data-tab export (one source of truth), with the church name as a parameter.
function exportSql() {
  const sql = fs.readFileSync(path.join(__dirname, 'churchsuite-export-songstack.sql'), 'utf8');
  const needle = "WHERE c.name = 'Endcliffe Church';";
  if (!sql.includes(needle)) throw new Error('churchsuite-export-songstack.sql changed — church filter not found');
  return sql.replace(needle, 'WHERE c.name = $1;');
}

// Split a report into date blocks: { "══ Sun, 22 Nov 2026 …": "block text" }. The header line
// (export time) and summary are left out, so they never trigger an email on their own.
function blocks(text) {
  const out = {};
  let key = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('══ Summary')) { key = null; continue; }
    if (line.startsWith('══ ')) { key = line; out[key] = []; continue; }
    if (key) out[key].push(line);
  }
  for (const k of Object.keys(out)) out[k] = out[k].join('\n').trim();
  return out;
}

// sendBrevoEmail resolves with { status, body } even when Brevo refuses — treat anything but 2xx as a failure.
async function send(msg) {
  const r = await sendBrevoEmail(msg);
  if (!r || r.status < 200 || r.status >= 300) {
    // Describe the key without revealing it, so a wrong/blank variable is easy to spot in the logs.
    const k = process.env.BREVO_API_KEY || '';
    console.error(`  BREVO_API_KEY: ${k.length} chars, starts with ${k.startsWith('xkeysib-') ? '"xkeysib-" (API key — right type)' : k.startsWith('xsmtpsib-') ? '"xsmtpsib-" (SMTP key — WRONG type)' : k.startsWith('${{') ? '"${{" (reference not resolved)' : 'something else'}${/\s|["']/.test(k) ? ', contains spaces or quotes' : ''}`);
    throw new Error(`Brevo refused the email (${r && r.status}): ${r && r.body}`);
  }
  return r;
}

const pre = s => `<pre style="font-family:Menlo,Consolas,monospace;font-size:12px;line-height:1.45;white-space:pre-wrap">${escapeHtml(s)}</pre>`;

async function run() {
  const { rows: [church] } = await pool.query('SELECT id, name FROM churches WHERE name = $1', [CS_SHADOW_CHURCH]);
  if (!church) throw new Error(`No SongStack church called "${CS_SHADOW_CHURCH}"`);

  const cs = createClient(CS_CLIENT_ID, CS_CLIENT_SECRET);
  const from = new Date(); from.setDate(from.getDate() - 1);
  const to = new Date(); to.setDate(to.getDate() + 49);

  // Sync first (or a rolled-back preview of it), so the report below shows what's left afterwards.
  const sync = await applySync({ pool, cs, churchId: church.id, from: ymd(from), to: ymd(to), apply: APPLY, runId: crypto.randomUUID() });
  const syncText = formatSync(sync, APPLY);
  console.log(`Sync (${APPLY ? 'APPLIED' : 'preview only'}): ${sync.actions.length} change(s), ${sync.notes.length} note(s).`);

  const { rows: [{ export: exported }] } = await pool.query(exportSql(), [CS_SHADOW_CHURCH]);
  const ss = JSON.parse(exported);
  const { text, summary } = await buildReport(cs, ss, ymd(from), ymd(to));

  // The sync's notes (and, in report mode, its preview) are stored as part of the report, so a change
  // there sends an email too. Applied changes always send one (below), so they're left out.
  const stored = `${text}\n\n══ Sync\n${formatSync({ actions: APPLY ? [] : sync.actions, notes: sync.notes }, APPLY)}`;
  const now = blocks(stored);
  const hash = crypto.createHash('sha256').update(JSON.stringify(now)).digest('hex');
  const { rows: [last] } = await pool.query(
    'SELECT report_hash, report_text, created_at FROM churchsuite_shadow_reports WHERE church_id = $1 ORDER BY created_at DESC LIMIT 1',
    [church.id]);

  // What changed: dates that are new or whose block differs. Dates that dropped off the
  // window (last Sunday) are ignored, so the weekly roll-forward doesn't send an email.
  const before = last ? blocks(last.report_text) : {};
  const changed = Object.keys(now).filter(k => before[k] !== now[k]);
  const first = !last;

  if (DRY) {
    console.log(`── Sync preview ──\n${syncText}\n`);
    console.log(text);
    console.log(`\n[dry] ${first ? 'first report' : `${changed.length} date(s) changed since ${last.created_at.toISOString()}`} — nothing saved or sent.`);
    return;
  }
  const applied = APPLY && sync.actions.length > 0;
  if (!applied && !first && last.report_hash === hash) { console.log('No change since last report — nothing sent.'); return; }
  if (!applied && !first && changed.length === 0) {
    // Only past dates dropped off. Save quietly so the next comparison starts from here.
    await pool.query('INSERT INTO churchsuite_shadow_reports (church_id, report_hash, report_text) VALUES ($1,$2,$3)', [church.id, hash, stored]);
    console.log('Only past dates dropped off — saved, nothing sent.');
    return;
  }

  const changedHtml = first ? '' :
    `<h3 style="font-family:sans-serif">What's changed since the last report (${escapeHtml(last.created_at.toUTCString())})</h3>` +
    changed.map(k => {
      const oldLines = new Set((before[k] || '').split('\n'));
      const fresh = now[k].split('\n').filter(l => l.trim() && !oldLines.has(l));
      const gone = (before[k] || '').split('\n').filter(l => l.trim() && !now[k].split('\n').includes(l));
      return pre(`${k}\n${before[k] ? '' : '  (new date)\n'}${fresh.map(l => `NOW   ${l.trim()}`).join('\n')}${gone.length ? '\n' + gone.map(l => `WAS   ${l.trim()}`).join('\n') : ''}`);
    }).join('');

  const html =
    (APPLY
      ? `<p style="font-family:sans-serif">ChurchSuite → SongStack <strong>sync</strong> for ${escapeHtml(church.name)}.</p>` +
        `<h3 style="font-family:sans-serif">${applied ? 'Changed in SongStack just now' : 'Nothing changed in SongStack this time'}</h3>` + pre(syncText) +
        `<p style="font-family:sans-serif;font-size:12px;color:#666">To undo the latest run: backend/migrations/2026-11-17-churchsuite-undo-last-run.sql in the Railway Data tab.</p>`
      : `<p style="font-family:sans-serif">ChurchSuite → SongStack <strong>dry run</strong> for ${escapeHtml(church.name)}. ` +
        `Nothing has been changed in SongStack — this shows what a sync <em>would</em> do.</p>` +
        `<h3 style="font-family:sans-serif">What the sync would do</h3>` + pre(syncText)) +
    pre(summary) + changedHtml +
    `<h3 style="font-family:sans-serif">Full report</h3>` + pre(text);

  await send({
    to: CS_SHADOW_EMAIL,
    toName: church.name,
    subject: applied ? `ChurchSuite sync: ${sync.actions.length} change(s) made in SongStack (${church.name})`
      : first ? `ChurchSuite ${APPLY ? 'sync' : 'dry run'}: first report (${church.name})`
      : `ChurchSuite ${APPLY ? 'sync' : 'dry run'}: ${changed.length} date(s) changed (${church.name})`,
    htmlContent: html,
  });
  await pool.query('INSERT INTO churchsuite_shadow_reports (church_id, report_hash, report_text) VALUES ($1,$2,$3)', [church.id, hash, stored]);
  await pool.query("DELETE FROM churchsuite_shadow_reports WHERE church_id = $1 AND created_at < now() - interval '60 days'", [church.id]);
  console.log(`Report emailed to ${CS_SHADOW_EMAIL} (${applied ? `${sync.actions.length} change(s) applied` : first ? 'first report' : `${changed.length} date(s) changed`}).`);
}

run()
  .catch(async e => {
    console.error('✗', e.message);
    process.exitCode = 1;
    // Tell someone, so a broken secret doesn't fail silently for weeks.
    if (!DRY && CS_SHADOW_EMAIL && process.env.BREVO_API_KEY) {
      await send({ to: CS_SHADOW_EMAIL, subject: 'ChurchSuite dry run FAILED', htmlContent: pre(e.stack || e.message) })
        .catch(err => console.error('✗ Could not send the failure email either:', err.message));
    }
  })
  .finally(() => pool.end());
