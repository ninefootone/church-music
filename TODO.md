# Song Stack — TODO

## Backlog

### Features – General

- [ ] Remove inline styles across all frontend files (see below)
- [ ] Clerk major version upgrade — currently on v5.7.5, latest is v7.x; check migration guides for v5→v6 and v6→v7 before updating; test all auth flows (sign in, sign up, onboarding redirect) on a preview branch first
platform-wide stats: number of churches, total songs, total plans, total users, storage used; no church-level data exposed

### Features – Print/View
- [ ] Single file viewer — route at /songs/[id]/view/[fileId] that opens a single PDF or ChordPro file in the full set viewer (same component, single file); accessible from the song page for rehearsal use; supports swipe/keyboard navigation and auto-hide controls

### Features – Songs
- [ ] 'Share all data' flag on songs — master library account only; marks a song as fully shareable so all fields and files are copied across to other churches via the shared library/template system
- [ ] Retire a song — soft-delete: add a `retired` boolean flag to songs, hide retired songs from the main library and plan song-picker by default, but keep them in the DB; include a "Show retired songs" toggle on the songs page and a "Retire / Restore" button on the song detail page
- [ ] ChordPro inline editing — "Edit" button in the viewer toolbar opens a textarea with raw ChordPro text; save writes updated content back to R2 via a new PUT endpoint; admin only
- [ ] Consolidate tags — review remaining ~108 tags after initial cleanup; aim for a clean controlled vocabulary of ~20–25 tags

### Features – Admin
- [ ] Plan email — send a HTML-formatted email with the full plan outline (song titles, arrangements, musicians) and links to any attached PDFs; triggered from the plan detail page; recipients could be the church members or a custom address list
- [ ] Super-admin dashboard at `/admin` — route only accessible to a hardcoded Clerk user ID (Jon's account) 
- [ ] Account deletion — settings page option for users to delete their own account (Clerk backend API + DB cleanup)
– [ ] Rehearsal plan option for members

### Features – Stats
- [ ] Song ordering on songs page — sort by most/least sung
- [ ] Show next planned date on individual song page

### Features – Discover
– [ ] Add artwork to 'Discover' songs
- [ ] Discover area — `/discover` route visible to all logged-in churches; searches/browses only songs from the master library account that have `share_all_data` enabled; completely separate from a church's own song list; results show title, tags, key, CCLI info, arrangement preview, and an "Add to my library" button that deep-copies the song (and optionally its shared files) into the church's own DB; paginated with full-text search and tag/theme filtering
- [ ] Master library curation workflow — the master library account gets an extra "Discover visibility" toggle per song (wraps the `share_all_data` flag); curator(s) can add a short "curator note" (e.g. "Great contemporary anthem, works well acoustic") stored in a new `curator_note` column on `songs`; this note shows in Discover results but not in the church's own library after import
- [ ] "New in Discover" dashboard highlight — once Discover exists, show a small "New songs added" card on the dashboard for churches that haven't seen the latest additions; track last-seen timestamp per church so the highlight clears after they visit `/discover`; lays groundwork for future community/social features
- [ ] Account deletion — settings page option for users to delete their own account (Clerk backend API + DB cleanup)

### Inline style refactor
Work through each file, one at a time, using VSCode/Cursor prompt to move all
static inline `style={{...}}` props to named classes in `globals.css`.

- [x] `src/app/page.tsx`
- [ ] `src/app/(app)/dashboard/page.tsx`
- [ ] `src/app/(app)/songs/page.tsx`
- [ ] `src/app/(app)/songs/[id]/page.tsx`
- [ ] `src/app/(app)/songs/[id]/edit/page.tsx`
- [ ] `src/app/(app)/songs/new/page.tsx`
- [ ] `src/app/(app)/plans/page.tsx`
- [ ] `src/app/(app)/plans/[id]/page.tsx`
- [ ] `src/app/(app)/plans/[id]/edit/page.tsx`
- [ ] `src/app/(app)/plans/new/page.tsx`
- [ ] `src/app/(app)/stats/page.tsx`
- [ ] `src/app/(app)/layout.tsx`
- [ ] `src/components/ui/AddToPlanModal.tsx`
- [ ] `src/components/ui/FileUploadModal.tsx`
- [ ] `src/components/ui/InviteMemberModal.tsx`
- [ ] `src/components/ui/ConfirmModal.tsx`
- [ ] `src/components/layout/AppNavClient.tsx`

## Done
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