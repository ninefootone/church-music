require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const churchRoutes = require('./routes/churches');
const songRoutes = require('./routes/songs');
const serviceRoutes = require('./routes/services');
const memberRoutes = require('./routes/members');
const uploadRoutes = require('./routes/uploads');
const statsRoutes = require('./routes/stats');
const templateRoutes = require('./routes/templates');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/churches', churchRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/templates', templateRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
