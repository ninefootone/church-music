require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Users (synced from Clerk)
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        clerk_id TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Churches
      CREATE TABLE IF NOT EXISTS churches (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        invite_code TEXT UNIQUE NOT NULL,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Memberships
      CREATE TABLE IF NOT EXISTS memberships (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'revoked')),
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(church_id, user_id)
      );

      -- Template / global song library (church_id = null means global template)
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

      -- Song tags (freeform)
      CREATE TABLE IF NOT EXISTS song_tags (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        UNIQUE(song_id, tag)
      );

      -- Song files (stored in R2)
      CREATE TABLE IF NOT EXISTS song_files (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        file_type TEXT NOT NULL CHECK (file_type IN ('chords','lead','vocal','full_score','other')),
        key_of TEXT,
        label TEXT,
        r2_key TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_size INTEGER,
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Services
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

      -- Service items (songs + non-song elements)
      CREATE TABLE IF NOT EXISTS service_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        item_type TEXT NOT NULL CHECK (item_type IN ('song','reading','prayer','sermon','welcome','confession','assurance','announcement','other')),
        song_id UUID REFERENCES songs(id),
        title TEXT,
        notes TEXT,
        key_override TEXT,
        duration_mins INTEGER
      );

      ALTER TABLE songs
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS bible_references TEXT,
        ADD COLUMN IF NOT EXISTS suggested_arrangement TEXT,
        ADD COLUMN IF NOT EXISTS ccli_url TEXT;

      CREATE TABLE IF NOT EXISTS song_videos (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        label TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS service_musicians (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE churches
        ADD COLUMN IF NOT EXISTS is_curator BOOLEAN DEFAULT FALSE;

      ALTER TABLE ccli_lookup
        ADD COLUMN IF NOT EXISTS category TEXT,
        ADD COLUMN IF NOT EXISTS first_line TEXT;

      CREATE TABLE IF NOT EXISTS ccli_lookup (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ccli_number TEXT NOT NULL,
        title TEXT NOT NULL,
        author TEXT,
        first_line TEXT,
        default_key TEXT,
        category TEXT,
        source_church_id UUID REFERENCES churches(id) ON DELETE SET NULL,
        confirmed_count INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(ccli_number)
      );
    `);
    console.log('Migration complete');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();