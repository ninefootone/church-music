# Church Music App

A song library and service planning tool for churches.
Built with Next.js · Node/Express · Postgres · Clerk · Cloudflare R2.

---

## Quick Start (Local Development)

```bash
# 1. Install dependencies
cd frontend && npm install
cd ../backend && npm install

# 2. Copy env files and fill in values (see setup sections below)
cp frontend/.env.local.example frontend/.env.local
cp backend/.env.example backend/.env

# 3. Run database migration
cd backend && npm run db:migrate

# 4. Start both servers (two terminals)
cd backend && npm run dev        # runs on :3001
cd frontend && npm run dev       # runs on :3000
```

---

## Service Setup

### 1. Clerk (Authentication)

1. Go to **clerk.com** → sign up with your new project Gmail
2. Create application → name it "Church Music"
3. Enable **Email** and **Google** sign-in methods
4. Go to **API Keys** in the Clerk dashboard
5. Copy keys into **frontend** `.env.local`:
   - Publishable key → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - Secret key → `CLERK_SECRET_KEY`
6. Copy **Secret key** into **backend** `.env` → `CLERK_SECRET_KEY`
7. In Clerk → **Redirects**, confirm these are set:
   - Sign-in: `/sign-in`
   - Sign-up: `/sign-up`
   - After sign-in: `/onboarding`
   - After sign-up: `/onboarding`

### 2. Railway (Backend + Database)

1. Go to **railway.app** → sign up with your project Gmail
2. **New Project** → **Add Service** → **Database** → **PostgreSQL**
3. Click the Postgres service → **Connect** tab → copy the `DATABASE_URL`
   → paste into backend `.env` as `DATABASE_URL`
4. **Add Service** → **Empty Service** → connect your GitHub repo
5. In that service's settings:
   - Root directory: `backend`
   - Start command: `node index.js`
6. Add all backend env vars in the Railway **Variables** tab
7. Once deployed, open a Railway shell and run: `node db/migrate.js`
8. Copy your Railway service URL (e.g. `https://xxx.up.railway.app`)
   → add as `NEXT_PUBLIC_API_URL` in Vercel (see below)

### 3. Vercel (Frontend)

1. Go to **vercel.com** → sign up with your project Gmail (or GitHub)
2. **Add New Project** → import your GitHub repo
3. Set **Root Directory** to `frontend`
4. Framework preset will auto-detect as Next.js ✓
5. Add these environment variables:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   = (from Clerk)
   CLERK_SECRET_KEY                    = (from Clerk)
   NEXT_PUBLIC_CLERK_SIGN_IN_URL       = /sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL       = /sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL = /onboarding
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL = /onboarding
   NEXT_PUBLIC_API_URL                 = (your Railway backend URL)
   ```
6. Deploy
7. **Important:** Go back to Clerk → **Domains** → add your Vercel URL
   as an allowed origin (e.g. `https://church-music.vercel.app`)

### 4. Cloudflare R2 (File Storage)

1. Log in to **cloudflare.com**
2. Sidebar → **R2 Object Storage** → **Create bucket**
3. Name: `church-music` · Leave access as **Private**
4. Go to **Manage R2 API Tokens** → **Create API Token**
5. Permissions: **Object Read & Write** on your `church-music` bucket
6. Copy values into backend `.env`:
   ```
   R2_ACCOUNT_ID        = (your Cloudflare Account ID — top right of dashboard)
   R2_ACCESS_KEY_ID     = (from the token you just created)
   R2_SECRET_ACCESS_KEY = (from the token you just created)
   R2_BUCKET_NAME       = church-music
   ```

---

## Deploying Updates

```bash
git add .
git commit -m "describe your change"
git push
```

Vercel and Railway auto-deploy on push to `main`. No manual steps needed.

---

## Project Structure

```
church-music/
├── frontend/                     # Next.js 14 app (→ Vercel)
│   └── src/
│       ├── app/
│       │   ├── (app)/            # Authenticated route group
│       │   │   ├── layout.tsx    # App shell with nav
│       │   │   ├── dashboard/    # Home dashboard
│       │   │   ├── songs/        # Songs list + detail + add/edit
│       │   │   ├── services/     # Services list + detail + add
│       │   │   └── stats/        # Usage stats + CCLI export
│       │   ├── onboarding/       # Create or join a church
│       │   ├── sign-in/          # Clerk sign-in
│       │   ├── sign-up/          # Clerk sign-up
│       │   └── s/[token]/        # Public read-only service view
│       ├── components/
│       │   ├── layout/AppNav     # Top navigation
│       │   └── ui/badges         # CategoryBadge, KeyBadge
│       ├── lib/api.ts            # Axios instance with auth header
│       └── types/index.ts        # All TypeScript types
│
└── backend/                      # Express API (→ Railway)
    ├── db/
    │   ├── pool.js               # Postgres connection pool
    │   └── migrate.js            # Run once to create all tables
    ├── middleware/
    │   └── auth.js               # requireAuth · requireMembership · requireAdmin
    ├── routes/
    │   ├── churches.js           # Create, join, manage churches
    │   ├── songs.js              # Song CRUD + search + usage stats
    │   ├── services.js           # Service planning + public token view
    │   ├── members.js            # Team management + role changes
    │   ├── uploads.js            # R2 file upload + signed download URLs
    │   ├── stats.js              # Top songs, CCLI export
    │   └── templates.js          # Global song library search + import
    └── index.js                  # Express entry point
```

---

## API Endpoints

All authenticated routes require:
- `Authorization: Bearer <clerk_token>` header
- `x-church-id: <uuid>` header (except `/churches/mine` and `/churches/join`)

```
GET    /health

# Churches
POST   /api/churches               Create a church
POST   /api/churches/join          Join via invite code
GET    /api/churches/mine          My churches
GET    /api/churches/:id           Church details
POST   /api/churches/:id/regenerate-invite

# Songs
GET    /api/songs                  List (supports ?category= ?search=)
GET    /api/songs/:id              Detail + files + usage
POST   /api/songs                  Create (admin)
PUT    /api/songs/:id              Update (admin)
DELETE /api/songs/:id              Delete (admin)

# Services
GET    /api/services               List (supports ?upcoming=true/false)
GET    /api/services/:id           Detail with items
GET    /api/services/public/:token Public view (no auth)
POST   /api/services               Create (admin)
PUT    /api/services/:id           Update (admin)
PUT    /api/services/:id/items     Replace all items (admin)
DELETE /api/services/:id           Delete (admin)

# Members
GET    /api/members                List church members
PUT    /api/members/:id/role       Change role (admin)
DELETE /api/members/:id            Revoke access (admin)

# Uploads
POST   /api/uploads/songs/:songId              Upload file (admin)
GET    /api/uploads/songs/:songId/files/:fileId/url  Signed download URL
DELETE /api/uploads/songs/:songId/files/:fileId      Delete file (admin)

# Stats
GET    /api/stats                  Top songs (supports ?period=30|90|365)
GET    /api/stats/ccli-export      CCLI report data

# Template library
GET    /api/templates/search       Search global library (?q=)
POST   /api/templates/:id/import   Import template to church
POST   /api/templates/contribute   Submit song as template
```

---

## Key Design Decisions

**Multi-tenancy** — every song, service, file and stat is scoped to a `church_id`. Single shared database, data never crosses between churches.

**Template library** — songs with `church_id = null` and `is_template = true` are the global starting-point library. Importing copies all metadata to the church's own record — no shared mutable state.

**Categories vs tags** — each song has exactly one category (Praise / Confession / Assurance / Communion / Lament / Response / Sending) for filtering, plus unlimited freeform tags for specifics.

**File storage** — only the R2 object key is stored in Postgres. Actual files live in R2. Download URLs are signed on request and expire after 1 hour.

**Public service view** — `/s/[token]` requires no login. Shows the running order with song titles, keys and YouTube links. Safe to share with musicians who aren't registered.

---

## Connecting Frontend to Backend

All pages currently use placeholder data. To wire up a page:

```tsx
// 1. Get Clerk token and attach to API client
import { useAuth } from '@clerk/nextjs'
import api, { setAuthToken } from '@/lib/api'

const { getToken } = useAuth()
const token = await getToken()
setAuthToken(token)

// 2. Set church ID header (store churchId in context/localStorage after onboarding)
api.defaults.headers.common['x-church-id'] = churchId

// 3. Fetch data
const { data } = await api.get('/api/songs')
```

A good next step is to create a `ChurchContext` that holds `churchId` and `role`,
loads on app mount, and wraps the `(app)` layout.
