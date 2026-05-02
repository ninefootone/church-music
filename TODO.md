# Song Stack — TODO

## In progress
- [ ] Remove inline styles across all frontend files (see below)

## Backlog

### Features
- [ ] Clerk major version upgrade — currently on v5.7.5, latest is v7.x; check migration guides for v5→v6 and v6→v7 before updating; test all auth flows (sign in, sign up, onboarding redirect) on a preview branch first
- [ ] Retire a song — soft-delete: add a `retired` boolean flag to songs, hide retired songs from the main library and service song-picker by default, but keep them in the DB; include a "Show retired songs" toggle on the songs page and a "Retire / Restore" button on the song detail page
- [ ] Service email — send a HTML-formatted email with the full service outline (song titles, arrangements, musicians) and links to any attached PDFs; triggered from the service detail page; recipients could be the church members or a custom address list
- [ ] Super-admin dashboard at `/admin` — route only accessible to a hardcoded Clerk user ID (Jon's account); shows platform-wide stats: number of churches, total songs, total services, total users, storage used; no church-level data exposed
- [ ] Tag autocomplete — show most-used tags as suggestions, plus ability to add your own
- [ ] Consolidate tags — review remaining ~108 tags after initial cleanup; merge duplicates/overlaps (e.g. King/Kingship, Saviour/Redeemer, Declaration/Proclamation, Eternal Life/Eternal); aim for a clean controlled vocabulary of ~60–70 tags
- [ ] Members can delete only their own services (permission scoping)
- [ ] Song ordering on songs page — sort by most/least sung
- [ ] Admin role change confirmation modal — replace alert() with ConfirmModal
- [ ] Show next planned date on individual song page
- [ ] Keyboard navigation on public share view
- [ ] Set mode embedded PDF viewer — replace the current "open in new tab" approach with an in-page viewer using react-pdf; full-screen, paginated left-to-right, keyboard and bluetooth foot pedal navigation (Page Up/Down, arrow keys); works in browser on iPad and desktop
- [ ] ChordPro support — allow .cho/.chordpro file uploads alongside PDF; render in-browser using chordsheetjs with live transposition key selector (eliminating need for multiple per-key PDF uploads); integrate into set mode as rendered HTML pages alongside PDF files
- [ ] Settings page
- [ ] Automated backups — periodic PostgreSQL dump stored in Cloudflare R2, just in case
- [ ] 'Share all data' flag on songs — master library account only; marks a song as fully shareable so all fields and files are copied across to other churches via the shared library/template system
- [ ] Discover area — `/discover` route visible to all logged-in churches; searches/browses only songs from the master library account that have `share_all_data` enabled; completely separate from a church's own song list; results show title, tags, key, CCLI info, arrangement preview, and an "Add to my library" button that deep-copies the song (and optionally its shared files) into the church's own DB; paginated with full-text search and tag/theme filtering
- [ ] Master library curation workflow — the master library account gets an extra "Discover visibility" toggle per song (wraps the `share_all_data` flag); curator(s) can add a short "curator note" (e.g. "Great contemporary anthem, works well acoustic") stored in a new `curator_note` column on `songs`; this note shows in Discover results but not in the church's own library after import
- [ ] "New in Discover" dashboard highlight — once Discover exists, show a small "New songs added" card on the dashboard for churches that haven't seen the latest additions; track last-seen timestamp per church so the highlight clears after they visit `/discover`; lays groundwork for future community/social features
- [ ] Configurable "services" terminology per church
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
- [ ] `src/app/(app)/services/page.tsx`
- [ ] `src/app/(app)/services/[id]/page.tsx`
- [ ] `src/app/(app)/services/[id]/edit/page.tsx`
- [ ] `src/app/(app)/services/new/page.tsx`
- [ ] `src/app/(app)/stats/page.tsx`
- [ ] `src/app/(app)/layout.tsx`
- [ ] `src/components/ui/AddToServiceModal.tsx`
- [ ] `src/components/ui/FileUploadModal.tsx`
- [ ] `src/components/ui/InviteMemberModal.tsx`
- [ ] `src/components/ui/ConfirmModal.tsx`
- [ ] `src/components/layout/AppNavClient.tsx`

## Done
- [x] WordPress song import (139 songs, 502 files)
- [x] New song fields — notes, bible_references, suggested_arrangement, ccli_url, song_videos
- [x] Today badge on services list and dashboard
- [x] Today section on services page
- [x] Fix landing page mobile header duplication
- [x] Clean up globals.css — remove duplicates, fix structure
- [x] Move (or duplicate) "Find lyrics on SongSelect" link to a more prominent position when adding/editing a song — duplicate it if CCLI autocomplete has been used
- [x] Add a copyright notice when adding songs explaining restrictions on storing lyrics/music — with a per-user "never show again" option
- [x] Drag and drop arrangement builder — common elements (Intro, Verse, Chorus, Bridge, Tag, Ending) with auto-incrementing numbers (Verse 1, Verse 2…) and manual override
- [x] PWA setup (waiting on icon asset)
- [x] Edit file label after upload (show filename alongside label for reference)
- [x] Upload multiple files at once with ability to edit all labels before saving
- [x] Add musicians to service — autocomplete from church members, plus ability to add non-signed-up guests
- [x] Custom arrangement per service — when adding a song, allow a custom arrangement for that specific service