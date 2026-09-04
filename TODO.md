# Song Stack — TODO

## Native apps (iOS + Android via Capacitor)

Decision log:
- Route: **Capacitor** wrapping the existing app — NOT a Swift/Kotlin rewrite. Reuses the current backend, API, auth and data model; ships one codebase for both stores plus web. Swift stays a someday-maybe (only justified later for native Apple Pencil drawing, and even then as a PencilKit *plugin* inside the same Capacitor app, not a rewrite).
- Why native over the PWA: App Store / Play Store install beats PWA install friction (the real barrier for average users), plus offline as insurance.
- v1 scope: **service player**. Find plans added on desktop → cache for offline → play in the set viewer with no signal → solo on-screen annotations stored locally. Mostly-online use assumed; offline is the safety net.
- Deferred on purpose: shared annotations (only ever *eventual* sync when online — live co-annotation is impossible in a no-signal room and is the highest-risk feature; solo-first), practice/ad-hoc setlists, full web-app parity, push notifications for plan reminders.
- Build it as the real, kept product — not throwaway scaffolding. Under-investing is what makes a wrapper feel "webby" and triggers a needless rewrite.

### Phase 1 — Offline bundling decision (the crux)
- [ ] Decide how the Next.js frontend is packaged for Capacitor to serve **offline** inside the app (client-rendered mobile bundle talking to the existing API vs pointing at the live URL). This single decision determines whether the app feels native or like a webview, and whether offline works at all. Server components + Clerk server-side auth make this non-trivial — resolve before scaffolding.

### Phase 2 — Developer accounts (has approval lag — start early)
- [ ] Apple Developer Program — $99/yr, identity verification can take a day+
- [ ] Google Play Console — $25 one-off

### Phase 3 — Capacitor scaffolding
- [ ] Add Capacitor to the repo; get the app running in the iOS simulator and Android emulator

### Phase 4 — Offline plan cache (the real engineering)
- [ ] Fetch and cache plans, songs and files (PDF + ChordPro) locally so a plan plays with no connection

### Phase 5 — Solo annotation layer
- [ ] Canvas overlay on the set viewer; finger + Apple Pencil via pointer events; annotations stored locally (IndexedDB), scoped per plan/file

### Phase 6 — Native-feel polish
- [ ] Touch target sizes, momentum scrolling, disable text-select and tap-highlight, set-viewer gestures, locked orientation, splash screen

### Phase 7 — Store assets & listings
- [ ] App icons, splash, store descriptions, screenshots, privacy declarations

### Phase 8 — Testing tracks
- [ ] TestFlight (iOS) + Play internal testing; real device testing in a church setting

### Phase 9 — Submit & publish
- [ ] Submit both stores; handle Apple review (the usual first-timer trap — build with its rules in mind from Phase 3 on)

## Backlog

- [ ] Database schema migrations — adopt a migration runner (e.g. node-pg-migrate) or at minimum a `schema_migrations` table, so "has this migration run?" is recorded in the database rather than remembered. The one-off scripts in `backend/db/` and `backend/scripts/` are currently applied by hand with no record of what's been run — this is the ambiguity that made syncing across machines uncertain. Keep the existing scripts as history; route new schema changes through the runner.

- [ ] Backend/frontend gate parity audit — the UI gates actions on flags (`free_access`, `subscription_status`, and role/permission flags like `can_manage_songs`) the backend must independently enforce. Divergences found & fixed: song limit, plan limit (tier gates), and the song-file routes in `uploads.js` (were `requireAdmin`, now `requirePermission('can_manage_songs')`). Still to audit: member/invite count, Stripe-gated features, and the plan/playlist permission routes. Backend is source of truth; frontend checks are UX only.

- [ ] Clerk v7 `createRouteMatcher` deprecation — v7 warns `createRouteMatcher` (in `frontend/src/middleware.ts`) will be removed next major; Clerk now recommends resource-based auth checks in each page/layout/route instead of path matching in middleware. Not urgent, still works. Guide: https://clerk.com/docs/guides/development/upgrading/upgrade-guides/migrate-from-create-route-matcher

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
- [ ] Single file viewer — route at /songs/[id]/view/[fileId] that opens a single PDF or ChordPro file in the full set viewer (same component, single file); accessible from the song page for rehearsal use; supports swipe/keyboard navigation and auto-hide controls

### Features – Admin
- [ ] Automated email reminders – email musicans 1 week before a plan
- [ ] Full offboarding process – account deletion — settings page option for users to delete their own account (Clerk backend API + DB cleanup)

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