# Song Stack — TODO

## Backlog

### Discover
- [ ] Dashboard Discover block — swipeable carousel showing in_discover songs with image, title, category and description; settings toggle (`hide_discover_dashboard` on `churches` table) to hide it

### Features – Print/View
- [ ] Single file viewer — route at /songs/[id]/view/[fileId] that opens a single PDF or ChordPro file in the full set viewer (same component, single file); accessible from the song page for rehearsal use; supports swipe/keyboard navigation and auto-hide controls

### Features – Songs
- [ ] Consolidate tags — review remaining ~108 tags after initial cleanup; aim for a clean controlled vocabulary of ~20–25 tags
- [ ] ChordPro inline editing — "Edit" button in the viewer toolbar opens a textarea with raw ChordPro text; save writes updated content back to R2 via a new PUT endpoint; admin only

### Features – Admin
- [ ] Automated email reminders – email musicans 1 week before a plan
- [ ] Full offboarding process – account deletion — settings page option for users to delete their own account (Clerk backend API + DB cleanup)

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
- [x] Clerk major version upgrade — currently on v5.7.5, latest is v7.x; check migration guides for v5→v6 and v6→v7 before updating; test all auth flows (sign in, sign up, onboarding redirect) on a preview branch first
platform-wide stats: number of churches, total songs, total plans, total users, storage used; no church-level data exposed
- [x] DB migration — new `church_playlists` table (`id`, `church_id`, `name`, `url`, `sort_order`, `created_at`) + new `can_manage_playlists` boolean on `memberships` table
- [x] Backend routes — `GET/POST/PUT/DELETE /api/playlists` on Express backend
- [x] Dashboard block — Playlists section between Plans and Feedback; admins and members with `can_manage_playlists` can add/edit/delete entries (name + URL only, no validation); read-only link list for all other members
- [x] Dashboard reorder — Songs & Plans (top), Playlists, Feedback/Questions, Team
- [x] Permission checkbox — add "Manage playlists" checkbox to member management modal in dashboard


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