# Entry action-bar icon cleanup

Clean up the entry page and list-overlay action bar from the 2026-07-24 UI review.

- [x] Replace the visible Back, Delete, and Share labels with accessible icon-only controls.
- [x] Keep Back alone on the left and align every other action in one consistent right-hand row.
- [x] Show Share in the entry overlay opened from the entries list.
- [x] Preserve tooltips/screen-reader names and make cancelling Delete stay on the entry.
- [x] Update the delete-flow selector and visually verify the full page plus list overlay.

## Verification

- `pnpm -F site check` — 0 errors (46 pre-existing warnings)
- `pnpm lint` — passed
- `pnpm -F site exec tsc --noEmit -p tsconfig.json` — passed
- `pnpm test -- --run` — 279 files / 1,975 tests passed; 1 file / 3 tests skipped
- `BASE_URL=http://localhost:3041 node site/e2e/live-delete-refresh.mjs` — passed, net-zero
- Headless browser at 900×600, light + dark:
  - full entry page and entries-list overlay both contain Back, JSON, Delete, Share, Star, History
  - every action measures 40×40 px; button and SVG centerlines are identical
  - Back is isolated left, every other control is grouped flush right
  - Back/Delete/Share contain no visible text and retain translated title + `aria-label`
  - cancelling Delete keeps the current entry open
  - no page/runtime/console errors
