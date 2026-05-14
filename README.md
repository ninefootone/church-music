# Song Stack

A song library and worship planning tool for churches.
Built with Next.js · Node/Express · PostgreSQL · Clerk · Cloudflare R2.

Live at [songstack.church](https://songstack.church)

---

## Quick Start (Local Development)

```bash
# 1. Install dependencies
cd frontend && npm install
cd ../backend && npm install

# 2. Copy env files and fill in values (see setup sections below)
cp frontend/.env.local.example frontend/.env.local
cp backend/.env.example backend/.env

# 3. Run database migrations
DATABASE_URL=postgresql://... node backend/db/migrate.js

# 4. Start both servers (two terminals)
cd backend && npm run dev        # runs on :3001
cd frontend && npm run dev       # runs on :3000
```

---

## Service Setup

### 1. Clerk (Authentication)

1. Go to **clerk.com** → create a new application
2. Enable **Email** and **Google** sign-in methods
3. Go to **API Keys** → copy keys into `frontend/.env.local`:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
4. Copy **Secret key** into `backend/.env` → `CLERK_SECRET_KEY`
5. In Clerk → **Redirects**, set:
   - Sign-in: `/sign-in`
   - Sign-up: `/sign-up`
   - After sign-in: `/onboarding`
   - After sign-up: `/onboarding`

### 2. Railway (Backend + Database)

1. Go to **railway.app** → New Project → Add Service → Database → PostgreSQL
2. Click the Postgres service → Connect tab → copy `DATABASE_URL` into `backend/.env`
3. Add Service → Empty Service → connect your GitHub repo
4. In that service's settings:
   - Root directory: `backend`
   - Start command: `node index.js`
5. Add all backend env vars in the Railway Variables tab
6. Run migrations: `DATABASE_URL=postgresql://your-railway-url node backend/db/migrate.js`
7. Copy your Railway service URL → add as `NEXT_PUBLIC_API_URL` in Vercel

### 3. Vercel (Frontend)

1. Go to **vercel.com** → Add New Project → import your GitHub repo
2. Set **Root Directory** to `frontend`
3. Add environment variables:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   CLERK_SECRET_KEY
   NEXT_PUBLIC_CLERK_SIGN_IN_URL       = /sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL       = /sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL = /onboarding
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL = /onboarding
   NEXT_PUBLIC_API_URL                 = (your Railway backend URL)
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY      = (from Google reCAPTCHA)
   ```
4. Deploy, then go back to Clerk → **Domains** → add your Vercel URL as an allowed origin

### 4. Cloudflare R2 (File Storage)

1. Log in to **cloudflare.com** → R2 Object Storage → Create bucket
2. Name: `church-music` · Access: Private
3. Manage R2 API Tokens → Create API Token → Object Read & Write
4. Copy values into `backend/.env`:
   ```
   R2_ACCOUNT_ID
   R2_ACCESS_KEY_ID
   R2_SECRET_ACCESS_KEY
   R2_BUCKET_NAME       = church-music
   ```
5. Create a second bucket `songstack-backups` for automated DB backups

### 5. Brevo (Transactional Email)

1. Go to **brevo.com** → API Keys → generate a key
2. Add to `backend/.env`:
   ```
   BREVO_API_KEY
   BREVO_FROM_EMAIL
   BREVO_FROM_NAME
   ```

### 6. Stripe (Billing)

1. Go to **stripe.com** → Developers → API Keys
2. Add to `backend/.env`:
   ```
   STRIPE_SECRET_KEY
   STRIPE_WEBHOOK_SECRET
   STRIPE_PRICE_ID_MONTHLY
   STRIPE_PRICE_ID_ANNUAL
   ```

---

## Deploying Updates

```bash
git add .
git commit -m "describe your change"
git push
```

Vercel (frontend) and Railway (backend) auto-deploy on push to `main`.

---

## Project Structure

```
church-music/
├── frontend/                          # Next.js app (→ Vercel)
│   └── src/
│       ├── app/
│       │   ├── (app)/                 # Authenticated route group
│       │   │   ├── layout.tsx         # App shell with nav
│       │   │   ├── dashboard/         # Home dashboard
│       │   │   ├── songs/             # Song library + detail + add/edit
│       │   │   ├── plans/             # Worship plans + set mode
│       │   │   ├── discover/          # Browse shared song library
│       │   │   ├── team/              # Team members
│       │   │   ├── stats/             # Usage stats + CCLI export
│       │   │   ├── settings/          # Church settings
│       │   │   ├── availability/      # Member availability
│       │   │   └── help/              # Help & support
│       │   ├── admin/                 # Super-admin dashboard (Jon only)
│       │   ├── onboarding/            # Create or join a church
│       │   ├── feedback/              # Feedback form
│       │   ├── legal/                 # Legal info
│       │   ├── privacy/               # Privacy policy
│       │   ├── sign-in/               # Clerk sign-in
│       │   ├── sign-up/               # Clerk sign-up
│       │   └── s/[token]/             # Public read-only plan view + set mode
│       ├── components/
│       │   ├── layout/AppNavClient    # Top navigation
│       │   └── ui/                    # Shared UI components
│       │       ├── badges.tsx         # CategoryBadge, KeyBadge
│       │       ├── ArrangementBuilder # Drag-and-drop arrangement editor
│       │       ├── ChordProViewer     # Fullscreen ChordPro viewer
│       │       ├── LyricsDisplay      # HTML + plaintext lyrics renderer
│       │       ├── LyricsEditor       # Rich lyrics editor
│       │       ├── FileRow            # Uploaded file row with inline edit
│       │       ├── TagInput           # Tag input with autocomplete
│       │       ├── CcliAutocomplete   # CCLI song search autocomplete
│       │       └── [modals]           # AddLink, AddToPlan, FileUpload,
│       │                              #   Invite, PlanEmail, PlanMusician,
│       │                              #   Confirm, CookieConsent
│       ├── context/ChurchContext      # Church + role state
│       ├── lib/api.ts                 # Axios instance with auth header
│       └── types/index.ts             # TypeScript types
│
└── backend/                           # Express API (→ Railway)
    ├── db/
    │   ├── pool.js                    # PostgreSQL connection pool
    │   └── migrate.js                 # Run to create/update tables
    ├── middleware/
    │   └── auth.js                    # requireAuth · requireMembership · requireAdmin
    ├── routes/
    │   ├── churches.js                # Create, join, manage churches
    │   ├── songs.js                   # Song CRUD + search + usage stats
    │   ├── plans.js                   # Plan CRUD + public token view + email
    │   ├── members.js                 # Team management + permissions
    │   ├── uploads.js                 # R2 file upload + signed URLs
    │   ├── stats.js                   # Top songs, CCLI export
    │   ├── templates.js               # Discover library search + import
    │   ├── ccli.js                    # CCLI song lookup
    │   ├── stripe.js                  # Billing + webhooks
    │   ├── feedback.js                # Feedback form submissions
    │   ├── mailing.js                 # Mailing list subscribe/unsubscribe
    │   ├── unavailability.js          # Member availability
    │   └── superadmin.js              # Super-admin endpoints
    └── index.js                       # Express entry point
```

---

## API Endpoints

All authenticated routes require:
- `Authorization: Bearer <clerk_token>` header
- `x-church-id: <uuid>` header (except `/churches/mine` and `/churches/join`)

```
GET    /health

# Churches
POST   /api/churches                        Create a church
POST   /api/churches/join                   Join via invite code
GET    /api/churches/mine                   My churches
GET    /api/churches/:id                    Church details
POST   /api/churches/:id/regenerate-invite  New invite code
PUT    /api/churches/:id/logo               Upload church logo

# Songs
GET    /api/songs                           List (supports ?category= ?search= ?sort=)
GET    /api/songs/:id                       Detail + files + usage
POST   /api/songs                           Create (admin)
PUT    /api/songs/:id                       Update (admin)
DELETE /api/songs/:id                       Delete (admin)

# Plans
GET    /api/plans                           List (supports ?upcoming=true/false)
GET    /api/plans/:id                       Detail with items + musicians
GET    /api/plans/public/:token             Public view (no auth)
POST   /api/plans                           Create
PUT    /api/plans/:id                       Update
PUT    /api/plans/:id/items                 Replace all items
DELETE /api/plans/:id                       Delete
POST   /api/plans/:id/email                 Send plan email to recipients
GET    /api/plans/:id/musicians             List musicians on a plan
POST   /api/plans/:id/musicians             Add musician
DELETE /api/plans/:id/musicians/:id         Remove musician

# Members
GET    /api/members                         List church members
PUT    /api/members/:id/role                Change role (admin)
PUT    /api/members/:id/permissions         Update capability flags (admin)
DELETE /api/members/:id                     Revoke access (admin)

# Uploads
POST   /api/uploads/songs/:songId                        Upload file (admin)
GET    /api/uploads/songs/:songId/files                  List files
GET    /api/uploads/public/songs/:songId/files           Public file list
GET    /api/uploads/songs/:songId/files/:fileId/url      Signed download URL
PUT    /api/uploads/songs/:songId/files/:fileId          Update file metadata
DELETE /api/uploads/songs/:songId/files/:fileId          Delete file (admin)

# Stats
GET    /api/stats                           Top songs (supports ?period=30|90|365)
GET    /api/stats/ccli-export               CCLI report CSV

# Discover / Templates
GET    /api/templates/search                Search shared library (?q= ?tag=)
POST   /api/templates/:id/import            Import to church library
POST   /api/templates/contribute            Submit song as template

# CCLI
GET    /api/ccli/search                     Search CCLI by title (?q=)

# Availability
GET    /api/unavailability                  My unavailability
POST   /api/unavailability                  Add unavailable date range
DELETE /api/unavailability/:id              Remove unavailability

# Stripe
POST   /api/stripe/create-checkout-session  Start subscription
POST   /api/stripe/webhook                  Stripe webhook handler
GET    /api/stripe/status                   Current subscription status

# Feedback
POST   /api/feedback                        Submit feedback form

# Mailing
POST   /api/mailing/subscribe               Subscribe to mailing list
POST   /api/mailing/unsubscribe             Unsubscribe

# Super-admin (Jon only)
GET    /api/superadmin/churches             All churches + stats
```

---

## Key Design Decisions

**Multi-tenancy** — every song, plan, file and stat is scoped to a `church_id`. Single shared database, data never crosses between churches.

**Shared library (Discover)** — songs with `share_all_data = true` on the master library account appear in `/discover`. Importing copies all metadata into the church's own record — no shared mutable state.

**Categories vs tags** — each song has exactly one category (Praise / Confession / Assurance / Communion / Lament / Response / Sending) for filtering, plus unlimited freeform tags for specifics.

**Permissions** — two roles (admin / member) with per-user capability flags (`can_manage_songs`, `can_add_plans`, `can_edit_any_plan`). Admins bypass all flag checks.

**File storage** — only the R2 object key is stored in PostgreSQL. Files live in R2. Download URLs are signed on request and expire after 1 hour.

**Public plan view** — `/s/[token]` requires no login. Shows the running order with song titles, keys, YouTube links and sheet music. Safe to share with musicians who aren't registered.

**Set mode** — `/s/[token]/set` lets musicians select which files to include for each song, then opens them in a fullscreen PDF/ChordPro viewer with keyboard and swipe navigation.

**Backups** — a Railway cron service runs nightly, dumps all PostgreSQL tables, gzip-compresses them, and uploads to `songstack-backups` R2 bucket.
