const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Give up on a new connection after 10s instead of waiting indefinitely, so a
  // database outage turns into an error response rather than a hung request.
  connectionTimeoutMillis: 10000,
});

// When the database restarts or the network drops, pg emits 'error' for idle
// connections sitting in the pool. With no listener Node treats that as an
// uncaught error and the whole API process exits. Log it instead: the broken
// connection is discarded and the next query opens a fresh one.
pool.on('error', (err) => {
  console.error('Postgres idle client error:', err.message);
});

module.exports = pool;
