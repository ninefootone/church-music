require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');

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

// Run migration then start server
const runMigration = async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    console.log('Running database migration...');
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        clerk_id TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS churches (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        invite_code TEXT UNIQUE NOT NULL,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS memberships (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'revoked')),
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(church_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS songs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        author TEXT,
        default_key TEXT,
        first_line TEXT,
        lyrics TEXT,
        category TEXT CHECK (category IN ('praise','confession','assurance','communion','lament','response','sending')),
        ccli_number TEXT,
        youtube_url TEXT,
        is_template BOOLEAN DEFAULT FALSE,
        template_status TEXT DEFAULT 'approved' CHECK (template_status IN ('pending','approved','rejected')),
        contributed_by UUID REFERENCES churches(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tags (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        UNIQUE(church_id, name)
      );

      CREATE TABLE IF NOT EXISTS song_tags (
        song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (song_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS song_files (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        file_type TEXT NOT NULL CHECK (file_type IN ('chords','lead','vocal','full_score','other')),
        key_of TEXT,
        label TEXT,
        r2_key TEXT NOT NULL,
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS services (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
        service_date DATE NOT NULL,
        service_time TEXT,
        title TEXT,
        notes TEXT,
        public_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS service_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        type TEXT NOT NULL CHECK (type IN ('song','reading','prayer','sermon','welcome','confession','assurance','announcement','other')),
        song_id UUID REFERENCES songs(id),
        title TEXT,
        notes TEXT,
        key_override TEXT,
        duration_mins INTEGER
      );
    `);
    console.log('Migration complete');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
};

const PORT = process.env.PORT || 3001;

runMigration().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
