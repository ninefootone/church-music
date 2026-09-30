// Account deletion — database side. No Clerk / R2 / Brevo calls in here so it can be
// tested against a bare Postgres; routes/account.js does the outside-world cleanup.
//
// Rules (agreed with Jon 2026-09-30):
//  - A church's ONLY admin can't delete while other active members remain ("make someone
//    else an admin first"). If they're the church's only active member, the church goes too.
//  - Past plans keep the role but lose the name ("Former member").
//  - Shared PDF markings stay (attribution is set NULL by the FK).
// Live-schema facts (audit 2026-09-30): churches.created_by = UUID FK, NO ACTION (blocks a
// user delete!); plans.created_by = TEXT holding a clerk_id (no FK); memberships +
// member_unavailability CASCADE; plan_musicians + shared_annotations SET NULL.

const ACTIVE_SUB = ['active', 'trialing', 'past_due'];

// db = pool or client. Returns { blockers, soleChurches }.
async function assess(db, user) {
  const admin = await db.query(
    `SELECT c.id, c.name, c.is_curator, c.subscription_status, c.stripe_subscription_id
       FROM memberships m JOIN churches c ON c.id = m.church_id
      WHERE m.user_id = $1 AND m.role = 'admin'`,
    [user.id]
  );
  const blockers = [];
  const soleChurches = [];
  for (const c of admin.rows) {
    const others = await db.query(
      `SELECT COUNT(*) FILTER (WHERE role = 'admin')   AS admins,
              COUNT(*) FILTER (WHERE role <> 'revoked') AS active
         FROM memberships WHERE church_id = $1 AND user_id <> $2`,
      [c.id, user.id]
    );
    if (parseInt(others.rows[0].admins, 10) > 0) continue; // someone else can run it
    if (parseInt(others.rows[0].active, 10) > 0) {
      blockers.push({ code: 'needs_admin', churchId: c.id, churchName: c.name });
    } else if (c.is_curator) {
      blockers.push({ code: 'curator_church', churchId: c.id, churchName: c.name });
    } else if (c.stripe_subscription_id && ACTIVE_SUB.includes(c.subscription_status)) {
      blockers.push({ code: 'active_subscription', churchId: c.id, churchName: c.name });
    } else {
      soleChurches.push({ id: c.id, name: c.name });
    }
  }
  return { blockers, soleChurches };
}

// Returns { blockers } (nothing changed), { alreadyGone: true }, or
// { erased: true, email, r2Keys, logoUrls } (COMMITTED — caller does the outside cleanup).
async function erase(pool, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialise double-taps / retries on the same user.
    const locked = await client.query('SELECT id, email FROM users WHERE id = $1 FOR UPDATE', [user.id]);
    if (locked.rowCount === 0) {
      await client.query('ROLLBACK');
      return { alreadyGone: true };
    }
    const email = locked.rows[0].email;

    const { blockers, soleChurches } = await assess(client, user);
    if (blockers.length) {
      await client.query('ROLLBACK');
      return { blockers };
    }

    const churchIds = soleChurches.map((c) => c.id);
    let r2Keys = [];
    let logoUrls = [];
    if (churchIds.length) {
      const files = await client.query(
        `SELECT sf.r2_key, sf.edited_r2_key
           FROM song_files sf JOIN songs s ON s.id = sf.song_id
          WHERE s.church_id = ANY($1::uuid[])`,
        [churchIds]
      );
      r2Keys = files.rows.flatMap((r) => [r.r2_key, r.edited_r2_key]).filter(Boolean);
      const logos = await client.query('SELECT logo_url FROM churches WHERE id = ANY($1::uuid[]) AND logo_url IS NOT NULL', [churchIds]);
      logoUrls = logos.rows.map((r) => r.logo_url);
      // Plans first: plan_items.song_id has no ON DELETE rule, so if the church's songs cascade away
      // before its plan_items do, Postgres refuses (found in testing 2026-09-30).
      await client.query('DELETE FROM plans WHERE church_id = ANY($1::uuid[])', [churchIds]);
      await client.query('DELETE FROM churches WHERE id = ANY($1::uuid[])', [churchIds]); // cascades the rest
    }

    // Order matters: plan_musicians.user_id goes NULL when the user row is deleted.
    await client.query(`UPDATE plan_musicians SET name = 'Former member' WHERE user_id = $1`, [user.id]);
    await client.query('UPDATE plans SET created_by = NULL WHERE created_by = $1', [user.clerk_id]);
    await client.query('UPDATE churches SET created_by = NULL WHERE created_by = $1', [user.id]);
    await client.query('DELETE FROM users WHERE id = $1', [user.id]); // cascades memberships + unavailability

    await client.query('COMMIT');
    return { erased: true, email, r2Keys, logoUrls };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // e.g. songs.contributed_by still points at a church we tried to delete
    if (err.code === '23503') return { blockers: [{ code: 'church_data_in_use', detail: err.constraint }] };
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { assess, erase };
