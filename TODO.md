# Song Stack — TODO

## Native app (iPad-first companion — React Native + Expo)

**Full detail, decisions and gotchas live in `claude/native-vs-app-shell.md` — read that first.**
This is just the high-level tracker.

Decision log (supersedes the old Capacitor plan):
- Route: **React Native + Expo companion app** — NOT Capacitor, NOT a web-app rewrite. The
  Capacitor/WebView shell was rejected (would feel "webby"; reliable offline + native PDF/Pencil
  annotation are the whole point). Reuses the existing backend/API/auth/data model (Clerk bearer
  token + `x-church-id` header); no backend changes needed.
- Scope: a focused **set viewer + annotation tool** for iPad, reading the live DB. Management stays
  in the web app. NOT a replica of the web app.
- Why native over PWA: App Store install + dependable offline for no-signal rooms.
- Repo: **github.com/ninefootone/song-stack-app** (private). Local folder: `~/songstack-spike`.

Done:
- [x] Apple Developer Program — enrolled as ORG (ninefootone creative limited).
- [x] EAS development build running on a registered iPad (Expo SDK 57).
- [x] Data layer — sign-in, browse churches/plans, drill to song files, live from the DB.
- [x] ChordPro viewer (transpose / capo / paginated).
- [x] In-app PDF viewer (react-native-pdf; single-page + tap-zone paging — rough, see doc).
- [x] Native Google sign-in (Clerk `useSSO`).
- [x] Plan lists show date + time + title, sorted and deduped.

Next:
- [x] **PDF annotation** — DONE: rasterised page image + one Skia canvas (`PdfView.tsx`), personal ink
      saved locally, plus a church-wide **shared** layer (admins / `can_annotate_plans`) synced via
      `/api/annotations` and polled every 15s while a PDF is open. See project doc `shared-annotations.md`.
- [ ] Offline caching — download PDF/ChordPro bytes + plan/song metadata locally (1h signed URLs
      are useless offline).
- [x] Annotation persistence — DONE (local personal markings + server-stored shared markings; no PDF round-trip).
- [ ] Bluetooth foot-controller page turns.
- [ ] Android build (same codebase) — later.
- [ ] Store assets, TestFlight, submit & review.
- [ ] **iPad app: plans don't refresh after web edits (found 2026-10-01).** (1) The Plans list (`HomeScreen.tsx`, effect keyed on `reloadKey` only) is fetched ONCE at mount — a title/date change or new plan made on the website only shows after quitting and relaunching the app. Fix: pull-to-refresh (`RefreshControl`) + re-run the load on `AppState` → active and when returning to the Plans tab. (2) A downloaded plan (✓ Offline) opens from the manifest snapshot with no network check (`openPlan`, by design) so web changes to its SONGS/ORDER never appear until remove + re-download, and — unlike custom sets — nothing says it's stale. Risk: leader swaps a song Saturday night, band plays Friday's download. Fix: when online, compare the server plan (`/plans/:id` item ids/order/key overrides) to the snapshot and show "Changed since download · Update" on the row and in plan detail. JS-only → ship by OTA AFTER App Store approval (reviewers' devices pull the production channel). Test on Dev first.

## Next up after plan templates — fixes + codebase review (agreed 2026-10-02)

**Phase 1 (known fixes) ALL DONE 2026-10-02** — song_id check, musicians routes locked down, PATCH routes off `can_edit_any_plan`, DuplicatePlanModal restyle, unused state removed, live `plans.status` default verified ('published'), stale schema retired (`db/history/migrate.js`), Plans → Templates page for plan editors. Detail: project doc `codebase-review.md`.

**Phase 2 — codebase review: backend routes DONE 2026-10-03.** Every route file read; 3 Critical, 4 High and ~16 Medium fixed, all 8 product decisions made with Jon. Full list, decisions and the commit for each: project doc `codebase-review.md`. New Railway env vars set: `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `BREVO_DOI_TEMPLATE_ID` (see `backend/.env.example`).
- [ ] Test superadmin church delete with a throwaway church (commit ba2dad3, untested).
- [ ] Review `middleware/auth.js`, `index.js` (CORS/helmet/body limits), `utils/*`.
- [ ] Lighter frontend pass: undefined CSS classes, inline styles, `tsc --noUnusedLocals` one-off, pages that GET then PUT whole objects.
- [ ] Low items in `codebase-review.md` (malformed UUID/missing date → 500s, R2 orphans on file delete, `/contribute` dead route, etc.).
- [ ] Drop unused columns `plan_items.duration_mins`, `memberships.can_edit_any_plan` — with the migration runner below.

## Backlog

- [ ] Database schema migrations — adopt a migration runner (e.g. node-pg-migrate) or at minimum a `schema_migrations` table, so "has this migration run?" is recorded in the database rather than remembered. The one-off scripts in `backend/db/` and `backend/scripts/` are currently applied by hand with no record of what's been run — this is the ambiguity that made syncing across machines uncertain. Keep the existing scripts as history; route new schema changes through the runner.

- [ ] Backend/frontend gate parity audit — the UI gates actions on flags (`free_access`, `subscription_status`, and role/permission flags like `can_manage_songs`) the backend must independently enforce. Divergences found & fixed: song limit, plan limit (tier gates), and the song-file routes in `uploads.js` (were `requireAdmin`, now `requirePermission('can_manage_songs')`). Still to audit: member/invite count, Stripe-gated features, and the plan/playlist permission routes. Backend is source of truth; frontend checks are UX only.

- [ ] Clerk v7 `createRouteMatcher` deprecation — v7 warns `createRouteMatcher` (in `frontend/src/middleware.ts`) will be removed next major; Clerk now recommends resource-based auth checks in each page/layout/route instead of path matching in middleware. Not urgent, still works. Guide: https://clerk.com/docs/guides/development/upgrading/upgrade-guides/migrate-from-create-route-matcher **Reviewed 2026-10-01 — deliberately deferred.** No deadline (removal only in the next major). Current middleware is `await auth()` with no `protect()`, so it isn't gating anything: real access control is the backend `requireAuth`. Migrating = code-style change, not a security gain; don't touch auth routing right before a launch/event. Also ~2 minor versions behind (nextjs 7.7.1 vs 7.9.9, backend 3.16.1 vs 3.21.1) — bump together with this. See project doc `clerk-auth-notes.md`.
- [ ] `requireAuth` hits Clerk's Backend API on EVERY request — `backend/middleware/auth.js` calls `clerkClient.users.getUser()` then upserts the `users` row each time. Clerk prod limit is 1000 BAPI requests/10s (429 + Retry-After); any failure currently becomes a 401, which the web client treats as an expired token and retries. Not a problem at today's volume; fix before any burst of real traffic: sync from Clerk only when the row is missing or not synced in the last few minutes (in-memory Map clerk_id → last sync). Costs: name/email changes show up on the Team page a few minutes late. Pairs with the existing 5xx-not-401 item.

- [ ] HTTP/2 stream-reset on early 403 for multipart routes — `requirePermission` now drains the body (`req.resume()`) before a 403, but `requireMembership`/`requireAdmin` don't, so a denied multipart upload they gate (e.g. master-library discover-image) could still surface `ERR_HTTP2_PROTOCOL_ERROR`. Low priority (admin-only); apply the same drain if it appears.

- [ ] Viewport metadata warning — Next 15 wants `viewport` in its own `export const viewport` rather than inside the `metadata` export (`layout.tsx`, sign-in, others). Cosmetic dev warning; move when convenient.

- [ ] Unsaved-changes "are you sure you want to leave?" warning — none exists today. Tier 1: `beforeunload` for tab-close/refresh (small; browser controls the wording). Tier 2: intercept in-app nav + back button, awkward on App Router (no `routeChangeStart`), needs a custom modal. Real cost is per-form dirty-tracking (~5 forms: new/edit song, new plan, plan settings, settings) — check whether the plan builder auto-saves first. Do Tier 1 first.


### Discover
- [ ] Dashboard Discover block — swipeable carousel showing in_discover songs with image, title, category and description; settings toggle (`hide_discover_dashboard` on `churches` table) to hide it
- [ ] Add events – Music Minsitry Conference etc.
- [ ] Add blogs – eg. Sovereign Grace

### Plans
- [ ] Plan-mode on songs page — select target plan first, then inline add buttons per song row, no modal
- [ ] Plans overview page — read-only /plans/overview, N upcoming plans in a grid, click-through to edit
- [ ] Plan item notes — fix Cmd+B/I shortcuts for annotator role (needs requestAnimationFrame fix in plans/[id]/page.tsx inline editor); fix italic rendering (item-notes class already italicises text, making <em> invisible — remove italic from .item-notes or use underline/colour for <em> within it)
- [ ] Soft-delete bin — add `deleted_at` column to plans; deleted plans move to a recoverable bin visible to admins; permanent delete requires a second confirmation; bin auto-purges after 30 days
- [ ] Audit log — `audit_log` table tracking plan created/edited/deleted events with user ID and timestamp; visible to admins only on the plan detail page or a dedicated admin view
- [ ] Reusable service-text snippets (aka liturgy library) — per-church library of named text blocks (creeds, prayers, welcome/call-to-worship scripts, communion words, benedictions, a monthly vision statement). New `church_liturgy_snippets` table (church_id, title, content, sort_order) following the existing per-church categories/tags/plan-item-types pattern; managed in Settings (add/edit/delete). In the plan builder an "Insert from library" action creates a plan_item with title + notes prefilled — reuses existing `plan_items.title/notes`, so no new set-viewer/print/share rendering path. PREREQ: verify the notes render path preserves line/stanza breaks across plan detail, set viewer AND public share (entangled with the item-notes `<em>`/Cmd+B/I bug above — creeds rely on deliberate line breaks). Keep content church-authored; do NOT ship a global seeded library (modern creed/service-book translations are copyrighted; ancient creeds are public domain). Frame as generic reusable snippets, not "liturgy" — contemporary churches reuse text too, so it's broader than it looks.

### Songs
- [ ] Hymnbook + hymn number fields (traditional-church request) — DECISION: add as two plain optional `TEXT` columns on `songs`, shown on the song form/detail and hidden-when-empty. First confirm existing added fields (`bible_references` etc.) already hide when blank; if so, NO settings toggle — a toggle carries real conditional-rendering cost across every song surface and sets the precedent that every niche field earns a switch (→ settings sprawl). Deliberately NOT building generic custom fields yet: right long-term abstraction (same global+per-church pattern as categories/tags) but premature for one church — revisit if denominational-field requests keep coming (tune name, meter, composer/author split). Known model limit: a single hymnbook/number pair breaks for churches using multiple hymnbooks — accepted for now.

### Features – Print/View
- [ ] Shared markings on the website (decided NOT now, 2026-10-01) — read-only overlay would only reach the set viewer (song-page files open as raw PDF tabs, so it needs the single-file viewer below first) and markings can only be drawn on the iPad. Revisit if web usage shows demand. Gotcha if built: iPad renders the PDF MediaBox, pdf.js the CropBox — verify strokes line up on real files.
- [ ] Single file viewer — route at /songs/[id]/view/[fileId] that opens a single PDF or ChordPro file in the full set viewer (same component, single file); accessible from the song page for rehearsal use; supports swipe/keyboard navigation and auto-hide controls

### Features – Admin
- [ ] Automated email reminders – email musicans 1 week before a plan
- [x] Full offboarding process – account deletion — DONE 2026-09-30 on BOTH the iPad app and the website (Account page → Delete account): `DELETE /api/account` + `GET /api/account/deletion-check` (see project doc `account-deletion.md`). Clerk's own web "Delete account" stays OFF. Privacy policy rewritten to match (`privacy-policy-and-app-links.md`).
- [x] Fix `/api/superadmin/churches/:id` delete ordering — DONE 2026-10-02 (ba2dad3): DB first in one transaction (plans, then church), R2 files after. Not yet tested on live.
- [ ] `requireAuth` should return 5xx (not 401) when the DB is down, and `/health` should ping the DB — a DB outage currently looks like a sign-in problem.
- [ ] Backend → Railway private DB address (`…railway.internal:5432`) instead of the public proxy host; do at a quiet time, confirm `Server running on port` in the deploy log (the boot-time migration that printed `Migration complete` was removed 2026-10-02) and that the app loads.
- [ ] iPad app: if the signed-in account is deleted elsewhere (e.g. on the web) the app shows "You're offline" — detect session-invalid vs offline and sign out.
- [ ] App Store listing + App Privacy answers (iPadOS 16.4+, no tracking); Privacy Policy URL = https://app.songstack.church/privacy.

## Done
- [x] Lyrics on plan detail — expanding a song in the plan running order shows a "Show lyrics" toggle when the song has lyrics (`songs.lyrics`), rendered via the shared `LyricsDisplay`. Added `s.lyrics AS song_lyrics` to the authenticated plan-detail query only (public-share query left untouched — lyrics stay off shared links).
- [x] Church-extensible categories — `categories` table (global + per-church); add/delete in Settings (usage counts, admin-only); data-driven dropdown on the song form and data-driven single-select filter chips on the songs page. Delete nulls `songs.category` (songs go uncategorised, not orphaned). See `categories.md`.
- [x] Church-extensible tags + theme filtering — hybrid global/church tag vocabulary; multi-select tag filter on the songs page (`?tags=` AND-logic) delivering "searchable by theme"; Settings tag-management block with per-tag usage counts and informed delete. See `tags.md`.
- [x] Clerk v5 → v7 upgrade (actually done — packages bumped, not just app code) — `@clerk/nextjs`→v7, `@clerk/backend`→v3. Fixed the production RSC render crash on `/team` and `/sign-in` (old ClerkProvider called `headers()` synchronously; Next 15.5 throws — vercel/next.js#71624) and cleared the critical `@clerk/shared` CVE. App code was already v6/v7-shaped, so mostly a package bump. Sign-in verified on production.
- [x] Non-admin song uploads — song-file routes required `requireAdmin`, blocking members with `can_manage_songs`; the 403 fired before multer drained the body, surfacing as `ERR_HTTP2_PROTOCOL_ERROR`. Switched the five song-file routes to `requirePermission('can_manage_songs')` (discover-image stays admin), guarded `/songs/new` behind `canManageSongs`, and made `requirePermission` drain the body + return a clean 403.
- [x] Free-access gate fix — `free_access` churches were still blocked by the backend song (5) and plan (1) limits because the gates in `backend/routes/songs.js` and `backend/routes/plans.js` only checked `subscription_status`, ignoring `free_access` (which the frontend already honoured). Backend gates now exempt `free_access` churches, matching the UI.
- [x] WordPress song import (139 songs, 502 files)
- [x] New song fields — notes, bible_references, suggested_arrangement, ccli_url, song_videos
- [x] Today badge on plans list and dashboard
- [x] Today section on plans page
- [x] Fix landing page mobile header duplication
- [x] Clean up globals.css — remove duplicates, fix structure
- [x] Move (or duplicate) "Find lyrics on SongSelect" link to a more prominent position when adding/editing a song
- [x] Add copyright notice when adding songs explaining restrictions — with a per-user "never show again" option
- [x] Drag & drop arrangement builder — (Intro, Verse, Chorus, Bridge, Tag, Ending) with auto-incrementing numbers
- [x] PWA setup (waiting on icon asset)
- [x] Edit file label after upload (show filename alongside label for reference)
- [x] Upload multiple files at once with ability to edit all labels before saving
- [x] Add musicians to plan — autocomplete from church members, plus ability to add non-signed-up guests
- [x] Custom arrangement per plan — when adding a song, allow a custom arrangement for that specific plan
- [x] ChordPro support — allow .cho/.chordpro file uploads alongside PDF
- [x] ChordPro set viewer pagination
- [x] ChordPro key override in set picker — allow per-file key selection in the set picker
- [x] Keyboard navigation on public share view
- [x] Admin role change confirmation modal — replace alert() with ConfirmModal
- [x] Tag autocomplete — show most-used tags as suggestions, plus ability to add your own
– [x] Show default key on song lists – enter for all songs in master library
- [x] Automated backups — periodic PostgreSQL dump stored in Cloudflare R2, just in case
- [x] Settings page
– [x] Add 'Band Leader' role – can add plans
- [x] 'Band Leaders' can delete only their own plans (permission scoping)
– [x] Remove ability to add plans from normal members
– [x] Paywall / Stripe
- [x] Print/download merged PDF — from the set picker, a "Download PDF" button that merges selected PDF files into a single downloadable PDF using pdf-lib (as previously built); useful for printing a full plan's worth of music
- [x] Plan email — send a HTML-formatted email with the full plan outline (song titles, arrangements, musicians) and links to any attached PDFs; triggered from the plan detail page; recipients could be the church members or a custom address list
- [x] Super-admin dashboard at `/admin` — route only accessible to a hardcoded Clerk user ID (Jon's account) 
- [x] Retire a song — soft-delete: add a `retired` boolean flag to songs, hide retired songs from the main library and plan song-picker by default, but keep them in the DB; include a "Show retired songs" toggle on the songs page and a "Retire / Restore" button on the song detail page
- [x] Show next planned date on individual song page
- [x] Song ordering on songs page — sort by most/least sung
- [x] 'Share all data' flag on songs — master library account only; marks a song as fully shareable so all fields and files are copied across to other churches via the shared library/template system
– [x] Add artwork to 'Discover' songs
- [x] Discover area — `/discover` route visible to all logged-in churches; searches/browses only songs from the master library account that have `share_all_data` enabled; completely separate from a church's own song list; results show title, tags, key, CCLI info, arrangement preview, and an "Add to my library" button that deep-copies the song (and optionally its shared files) into the church's own DB; paginated with full-text search and tag/theme filtering
- [x] Master library curation workflow — the master library account gets an extra "Discover visibility" toggle per song (wraps the `share_all_data` flag); curator(s) can add a short "curator note" (e.g. "Great contemporary anthem, works well acoustic") stored in a new `curator_note` column on `songs`; this note shows in Discover results but not in the church's own library after import
- [x] "New in Discover" dashboard highlight — once Discover exists, show a small "New songs added" card on the dashboard for churches that haven't seen the latest additions; track last-seen timestamp per church so the highlight clears after they visit `/discover`; lays groundwork for future community/social features
- [x] **"Next due to play" dashboard widget** — show each logged-in member their next upcoming plan on which they appear as a musician. Decisions needed before building:
  - Which plan statuses count? (draft vs published — needs a `status` field on plans if not already present)
  - Multi-plan display: show nearest only, or list all upcoming? Nearest is simpler; list is more useful
  - Empty state: "You're not scheduled" vs show nothing — former requires the musician feature to be actively used by admins
  - Depends entirely on admins populating plan musicians — will be empty/useless for churches that don't use that feature
  - Natural precursor to email reminders ("you're playing on Sunday — here's the plan"); don't design the widget in isolation from that future need
  - Consider `plan_availability` table (`plan_id`, `user_id`, `status: available|unavailable|unconfirmed`) for future unavailability/confirmation flow — design DB now even if UI comes later
platform-wide stats: number of churches, total songs, total plans, total users, storage used; no church-level data exposed
- [x] DB migration — new `church_playlists` table (`id`, `church_id`, `name`, `url`, `sort_order`, `created_at`) + new `can_manage_playlists` boolean on `memberships` table
- [x] Backend routes — `GET/POST/PUT/DELETE /api/playlists` on Express backend
- [x] Dashboard block — Playlists section between Plans and Feedback; admins and members with `can_manage_playlists` can add/edit/delete entries (name + URL only, no validation); read-only link list for all other members
- [x] Dashboard reorder — Songs & Plans (top), Playlists, Feedback/Questions, Team
- [x] Permission checkbox — add "Manage playlists" checkbox to member management modal in dashboard
- [x] ChordPro inline editing — "Edit" button in the viewer toolbar opens a textarea with raw ChordPro text; save writes updated content back to R2 via a new PUT endpoint; admin only
- [x] Consolidate tags — review remaining ~108 tags after initial cleanup; aim for a clean controlled vocabulary of ~20–25 tags
- [x] Library song detail/preview — clicking a song in the searchable library opens a panel or modal showing available details: lyrics preview (if share_all_data), author, copyright, tags, key, bible references, suggested arrangement; helps churches evaluate a song before adding it
- [x] Pre-service items — visual divider (injected, not stored) separates pre-service from service items; `phase` column on `plan_items` (default `'service'`); drag across divider updates phase; pre-service items show duration only, no calculated clock time

### Inline style refactor
- [x] `src/app/page.tsx`
- [x] `src/app/(app)/dashboard/page.tsx`
- [x] `src/app/(app)/songs/page.tsx`
- [x] `src/app/(app)/songs/[id]/page.tsx`
- [x] `src/app/(app)/songs/[id]/edit/page.tsx`
- [x] `src/app/(app)/songs/new/page.tsx`
- [x] `src/app/(app)/plans/page.tsx`
- [x] `src/app/(app)/plans/[id]/page.tsx`
- [x] `src/app/(app)/plans/[id]/edit/page.tsx`
- [x] `src/app/(app)/plans/[id]/set/page.tsx`
- [x] `src/app/(app)/plans/[id]/set/view/page.tsx`
- [x] `src/app/(app)/plans/[id]/settings/page.tsx`
- [x] `src/app/(app)/plans/new/page.tsx`
- [x] `src/app/(app)/layout.tsx`
- [x] `src/app/(app)/stats/page.tsx`
- [x] `src/app/(app)/settings/page.tsx`
- [x] `src/app/admin/page.tsx`
- [x] `src/app/(app)/help/page.tsx`
- [x] `src/app/(app)/team/page.tsx`
- [x] `src/app/(app)/plans/[id]/set/view/SetViewer.tsx`
- [x] `src/app/(app)/availability/page.tsx`
- [x] `src/app/(app)/discover/page.tsx`
- [x] `src/app/feedback/page.tsx`
- [x] `src/app/layout.tsx`
- [x] `src/app/legal/page.tsx`
- [x] `src/app/onboarding/page.tsx`
- [x] `src/app/privacy/page.tsx`
- [x] `src/app/s/[token]/set/view/page.tsx`
- [x] `src/app/sign-in/[[...sign-in]]/page.tsx`
- [x] `src/app/sign-up/[[...sign-up]]/page.tsx`
- [x] `src/app/s/[token]/set/view/PublicSetViewer.tsx`
- [x] `src/app/s/[token]/page.tsx`
- [x] `src/app/s/[token]/set/page.tsx`
- [x] `src/components/CcliAutocomplete.tsx`
- [x] `src/components/layout/AppNavClient.tsx`
- [x] `src/components/ui/AddLinkModal.tsx`
- [x] `src/components/ui/AddToPlanModal.tsx`
- [x] `src/components/ui/LegalNavActions.tsx` ← new
- [x] `src/components/ui/CookieSettingsLink.tsx` ← new
- [x] `src/components/ui/FeedbackForm.tsx` ← new
- [x] `src/components/ui/LyricsEditor.tsx` ← new
- [x] `src/components/ui/TagInput.tsx` ← new
- [x] `src/components/ui/ArrangementBuilder.tsx`
- [x] `src/components/ui/ChordProViewer.tsx`
- [x] `src/components/ui/ConfirmModal.tsx`
- [x] `src/components/ui/FileUploadModal.tsx`
- [x] `src/components/ui/InviteMemberModal.tsx`
- [x] `src/components/ui/PlanEmailModal.tsx`
- [x] `src/components/ui/PlanMusicianModal.tsx`
- [x] `src/components/ui/CookieConsent.tsx`
- [x] `src/components/ui/LyricsDisplay.tsx`
- [x] `src/components/ui/badges.tsx`
- [x] `src/components/ui/FileRow.tsx`