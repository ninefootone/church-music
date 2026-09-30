// Account deletion (App Store guideline 5.1.1(v) — must be possible inside the app).
//   GET    /api/account/deletion-check  → { blockers, willDeleteChurches }  (nothing changes)
//   DELETE /api/account  { confirm: 'DELETE' }
// Order: database first (one transaction), then Clerk, then Brevo + R2 (best effort).
// If Clerk fails the DB is already clean and the call is safe to retry: requireAuth
// re-creates an empty users row, which the retry erases again.
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { createClerkClient } = require('@clerk/backend');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { deleteBrevoContact } = require('../utils/email');
const { assess, erase } = require('../utils/accountDeletion');

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const endpoint = process.env.R2_ENDPOINT || ('https://' + process.env.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com');
const r2 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});
const BUCKET = process.env.R2_BUCKET_NAME;

const MESSAGES = {
  needs_admin: (b) => `You're the only admin of ${b.churchName}. Make another member an admin (Team page on the website), then try again.`,
  curator_church: (b) => `${b.churchName} is the master library account and can't be deleted from here.`,
  active_subscription: (b) => `${b.churchName} has an active subscription. Cancel it first (Settings → Billing on the website), then try again.`,
  church_data_in_use: () => `Your church's songs are still used by another church, so it can't be deleted automatically. Please contact support.`,
};
const describe = (blockers) => blockers.map((b) => ({ ...b, message: (MESSAGES[b.code] || (() => 'This account can\'t be deleted right now.'))(b) }));

router.get('/deletion-check', requireAuth, async (req, res, next) => {
  try {
    const { blockers, soleChurches } = await assess(pool, req.user);
    res.json({ blockers: describe(blockers), willDeleteChurches: soleChurches.map((c) => c.name) });
  } catch (err) { next(err); }
});

router.delete('/', requireAuth, async (req, res, next) => {
  try {
    if (req.body?.confirm !== 'DELETE') return res.status(400).json({ error: 'Confirmation required' });

    const result = await erase(pool, req.user);
    if (result.blockers) {
      const blockers = describe(result.blockers);
      return res.status(409).json({ error: blockers[0].message, blockers });
    }

    // Outside-world cleanup. The database is already clean at this point.
    let clerkDeleted = true;
    try {
      await clerk.users.deleteUser(req.clerkUserId);
    } catch (e) {
      if (e?.status !== 404) { clerkDeleted = false; console.error('[account] Clerk delete failed:', e.message); }
    }
    // A request in flight can have re-created an empty users row via requireAuth — sweep it.
    if (clerkDeleted) await pool.query('DELETE FROM users WHERE clerk_id = $1', [req.clerkUserId]).catch(() => {});

    if (result.email) {
      deleteBrevoContact({ email: result.email }).catch((e) => console.warn('[account] Brevo delete failed:', e.message));
    }
    const publicBase = process.env.R2_PUBLIC_URL ? process.env.R2_PUBLIC_URL + '/' : null;
    const keys = [
      ...(result.r2Keys || []),
      ...(publicBase ? (result.logoUrls || []).filter((u) => u.startsWith(publicBase)).map((u) => u.slice(publicBase.length)) : []),
    ];
    const r2Results = await Promise.allSettled(keys.map((Key) => r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key }))));
    const failed = r2Results.filter((r) => r.status === 'rejected').length;
    if (failed) console.warn(`[account] ${failed}/${keys.length} R2 deletes failed`);
    console.log(`[account] erased user ${req.user.id} (clerkDeleted=${clerkDeleted}, files=${keys.length - failed})`);

    if (!clerkDeleted) {
      return res.status(502).json({ error: 'Your data was removed but sign-in removal failed. Please tap Delete again.', retry: true });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
