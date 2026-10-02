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

// Report errors passed via next(err) to Sentry. Must come after all routes and BEFORE the handler below.
Sentry.setupExpressErrorHandler(app);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

// Schema is NOT created here. A CREATE TABLE IF NOT EXISTS block used to run on
// every boot; it was a no-op on the live DB and out of date (it would have built
// the wrong schema on an empty DB), so it was removed 2026-10-02. Schema changes
// are the scripts in db/ and scripts/ — see project doc running-backend-scripts.md.

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
