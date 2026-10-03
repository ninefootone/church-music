// Shared ID checks. A malformed ID in a URL (or the x-church-id header) used to reach
// Postgres, which rejects it ("invalid input syntax for type uuid") → 500 + a Sentry
// report. Checking first turns that into a plain 404 / 400.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INT_ID_RE = /^[1-9][0-9]{0,8}$/; // SERIAL ids (church_playlists), kept well inside int4

const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
const isIntId = (v) => typeof v === 'string' && INT_ID_RE.test(v);

// Registers router.param checks: any route on `router` containing :name answers 404
// with `message` when that segment isn't a valid ID — before the handler (and before
// requireAuth, which is fine: a 404 for a malformed id reveals nothing).
//   requireIdParams(router, { id: 'Plan not found', itemId: 'Plan item not found' })
function requireIdParams(router, messages, check = isUuid) {
  for (const [name, message] of Object.entries(messages)) {
    router.param(name, (req, res, next, value) => {
      if (!check(value)) return res.status(404).json({ error: message });
      next();
    });
  }
}

module.exports = { UUID_RE, isUuid, isIntId, requireIdParams };
