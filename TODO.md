# Song Stack — TODO

## In progress
- [ ] Remove inline styles across all frontend files (see below)

## Backlog

### File management
- [ ] Edit file label after upload (show filename alongside label for reference)
- [ ] Upload multiple files at once with ability to edit all labels before saving

### Features
- [ ] Custom arrangement per service — when adding a song, allow a custom arrangement for that specific service
- [ ] Add musicians to service — autocomplete from church members, plus ability to add non-signed-up guests
- [ ] Tag autocomplete — show most-used tags as suggestions, plus ability to add your own
- [ ] Drag and drop arrangement builder — common elements (Intro, Verse, Chorus, Bridge, Tag, Ending) with auto-incrementing numbers (Verse 1, Verse 2…) and manual override
- [ ] Members can delete only their own services (permission scoping)
- [ ] Song ordering on songs page — sort by most/least sung
- [ ] Admin role change confirmation modal — replace alert() with ConfirmModal
- [ ] Show next planned date on individual song page
- [ ] Keyboard navigation on public share view
- [ ] Settings page
- [ ] Configurable "services" terminology per church
- [ ] PWA setup (waiting on icon asset)

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