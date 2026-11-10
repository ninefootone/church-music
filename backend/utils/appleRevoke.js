// Sign in with Apple token revocation on account deletion (App Store guideline 5.1.1(v)).
// Clerk does not revoke Apple tokens when a user is deleted, so we do it ourselves:
//   iPad sends a FRESH authorization code (from a native Apple sign-in sheet shown during Delete account)
//   → POST https://appleid.apple.com/auth/token (code → refresh/access token)
//   → POST https://appleid.apple.com/auth/revoke.
// Apple TN3194. The token must be revoked with the client_id that issued it (the iPad app's bundle id).
// Needs backend env: APPLE_TEAM_ID, APPLE_SIGNIN_KEY_ID, APPLE_SIGNIN_PRIVATE_KEY (the .p8 contents; "\n" escapes OK).
// Without them it does nothing (logs once per call). Best effort: never throws.
const crypto = require('crypto');

// Only our own iPad apps may be named as the client (prod, dev, preview variants).
const ALLOWED_CLIENT_IDS = new Set(['church.songstack.app', 'church.songstack.app.dev', 'church.songstack.app.preview']);
const APPLE = 'https://appleid.apple.com';

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function config() {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_SIGNIN_KEY_ID;
  const pem = (process.env.APPLE_SIGNIN_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  return teamId && keyId && pem ? { teamId, keyId, pem } : null;
}

// ES256 client secret JWT, valid 5 minutes.
function clientSecret(clientId, { teamId, keyId, pem }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const payload = b64url(JSON.stringify({ iss: teamId, iat: now, exp: now + 300, aud: APPLE, sub: clientId }));
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), { key: pem, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${b64url(sig)}`;
}

async function post(path, form) {
  const res = await fetch(APPLE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, json, text };
}

// Returns 'revoked' | 'skipped:<why>' | 'failed:<why>'. Never throws.
async function revokeWithAuthorizationCode(code, clientId) {
  try {
    if (!code) return 'skipped:no_code';
    if (!ALLOWED_CLIENT_IDS.has(clientId)) return 'skipped:unknown_client';
    const cfg = config();
    if (!cfg) return 'skipped:not_configured';
    const secret = clientSecret(clientId, cfg);

    const tok = await post('/auth/token', { client_id: clientId, client_secret: secret, code, grant_type: 'authorization_code' });
    if (!tok.ok) return `failed:token_${tok.status}_${tok.json?.error || 'error'}`;
    const token = tok.json?.refresh_token || tok.json?.access_token;
    const hint = tok.json?.refresh_token ? 'refresh_token' : 'access_token';
    if (!token) return 'failed:no_token';

    const rev = await post('/auth/revoke', { client_id: clientId, client_secret: secret, token, token_type_hint: hint });
    return rev.ok ? 'revoked' : `failed:revoke_${rev.status}_${rev.json?.error || 'error'}`;
  } catch (e) {
    return `failed:${e?.message || 'error'}`;
  }
}

module.exports = { revokeWithAuthorizationCode, ALLOWED_CLIENT_IDS, _clientSecret: clientSecret };
