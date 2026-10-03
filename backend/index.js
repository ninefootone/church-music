require('dotenv').config();
const Sentry = require('./instrument'); // must stay first after dotenv
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const churchRoutes = require('./routes/churches');
const songRoutes = require('./routes/songs');
const planRoutes = require('./routes/plans');
const memberRoutes = require('./routes/members');
const uploadRoutes = require('./routes/uploads');
const statsRoutes = require('./routes/stats');
const templateRoutes = require('./routes/templates');
const ccliRoutes = require('./routes/ccli');
const stripeRoutes = require('./routes/stripe');
const feedbackRoutes = require('./routes/feedback');
const mailingRoutes = require('./routes/mailing');
const superAdminRoutes = require('./routes/superadmin');
const unavailabilityRoutes = require('./routes/unavailability');
const playlistRoutes = require('./routes/playlists');
const annotationRoutes = require('./routes/annotations');
const accountRoutes = require('./routes/account');
const planTemplateRoutes = require('./routes/planTemplates');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use('/api/stripe', stripeRoutes);
// Shared PDF markings: a page of ink can exceed express.json's 100kb default, so this route gets its own larger
// parser, mounted BEFORE the global one (body-parser skips already-parsed bodies).
app.use('/api/annotations', express.json({ limit: '2mb' }), annotationRoutes);
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/churches', churchRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/ccli', ccliRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/unavailability', unavailabilityRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/mailing', mailingRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/plan-templates', planTemplateRoutes);

// Unknown /api/... paths: JSON 404 (Express's default is an HTML "Cannot GET" page).
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Report errors passed via next(err) to Sentry. Must come after all routes and BEFORE the handler below.
Sentry.setupExpressErrorHandler(app);

app.use((err, req, res, next) => {
  // If part of the response has already gone (e.g. mid file stream), we can't send a JSON
  // error any more; hand over to Express, which closes the connection.
  if (res.headersSent) return next(err);
  // Client mistakes get a 4xx with a useful message instead of "Something went
  // wrong" (and, having a 4xx status, aren't reported to Sentry).
  if (err && err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large to upload.' : `Upload failed: ${err.message}`;
    return res.status(400).json({ error: msg });
  }
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large.' });
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body.' });
  if (err && err.expose && Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

// Schema is NOT created here. A CREATE TABLE IF NOT EXISTS block used to run on
// every boot; it was a no-op on the live DB and out of date (it would have built
// the wrong schema on an empty DB), so it was removed 2026-10-02. Schema changes
// are the scripts in db/ and scripts/ — see project doc running-backend-scripts.md.

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
