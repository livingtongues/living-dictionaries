# Analytics rolling 30-day visitors and level-2 access

Requested 2026-07-21:

- Change the **Top dictionaries by unique visitors** primary period from the
  current calendar month to the rolling last 30 days.
- Replace the private/unlisted lock glyph with gray italic `(unlisted)` text.
- Show the Analytics navigation tab and admin-dashboard card to level-2 admins.

## Plan

- [x] ✅ Compute true rolling 30-day visitor unions across hot `logs.db` and
  `logs-archive.db`, retaining the previous complete month and rolling 7-day
  comparison columns.
- [x] ✅ Update analytics types, fixtures, labels, explanatory copy, ranking, and
  anonymous share to use the 30-day primary period.
- [x] ✅ Replace the lock glyph with accessible secondary italic text.
- [x] ✅ Lower only the Analytics nav/card visibility threshold from level 3 to 2;
  keep Health and Schema at level 3. The analytics API/route is already gated to
  all allow-listed admins (`is_admin`, levels 2 and 3).
- [x] ✅ Add focused server tests and run unit, TypeScript/Svelte, lint, and visual
  screenshot verification.

## Implementation notes

- The existing `/api/admin/analytics` authorization already uses `is_admin`, so
  both levels 2 and 3 were permitted at the route boundary. Only the nav and card
  were hiding the page from level 2.
- Rolling visitors are an exact set union across both raw-log files. The previous
  complete month remains available from the forever monthly rollup as a stable
  comparison column.
- Added level-2 svelte-look stories for both the admin shell and dashboard page.

## Verification ✅

- Focused analytics suite: 36/36 passed.
- Full Vitest suite: 1,741 passed, 3 skipped (240 files passed, 1 skipped).
- `pnpm check`: 0 errors (46 existing warnings).
- `pnpm lint`: passed.
- `tsc --noEmit`: passed.
- Svelte analyzer: no new issues; it reported only pre-existing link-resolution
  and unused-selector notices in the touched components.
- Svelte-look screenshots inspected in light + dark for Analytics, the level-2
  admin nav, and the level-2 admin dashboard card grid.
