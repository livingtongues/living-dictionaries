# Admin users + dictionaries: pagination, sticky headers, nav reorder, delete buckets

## Decisions (from Jacob)
- **Sticky model:** Option A — bounded table region that scrolls internally (`max-height` fills
  remaining viewport). Filters/search/pagination stay put; header pins at top of the table region.
  Keeps horizontal scroll contained to the wide 21-col dictionaries table.
- **Page size:** 100 rows/page.
- **Controls:** Prev / Next + numbered pages + "showing 51–100 of 1,240" count.
- **Shared component:** `site/src/lib/components/ui/Pagination.svelte`.
- **Reorder** header nav + dashboard cards → Dictionaries, Users, Messages, Chat, then the rest in
  current relative order.
- **Delete `/admin/buckets`** entirely (no mismatch port). Remove nav link.

## Why the current sticky header fails
`.table-wrap { overflow-x: auto }` makes the wrap a scroll container on BOTH axes (CSS spec: one
axis non-visible forces the other to `auto`). `thead { position: sticky; top: 0 }` therefore pins
to the top of the never-vertically-scrolled wrap and rides off-screen. Fix = give `.table-wrap` a
bounded `max-height` + `overflow: auto` so it becomes the vertical scroller and the sticky engages.

## Tasks — ALL DONE ✅
- [x] `components/ui/Pagination.svelte` (prev/next + numbered + count). Props: `page`, `page_size`,
      `total`, `on_change`, `noun`. Emits 1-based page.
- [x] `utils/fill-remaining-height.ts` action — bounds an element's max-height to fill the viewport
      (used on `.table-wrap` so the sticky header actually pins). Needed because `.table-wrap` must
      be `overflow: auto` (both axes) for vertical sticky to engage.
- [x] users/+page.svelte: paginate (100), bounded scroll region, reset page on sort/filter/search,
      dropped MAX_RENDER + results-count note.
- [x] dictionaries/+page.svelte: same (+ row index made page-aware).
- [x] admin/+layout.svelte: reorder nav (Dictionaries, Users, Messages, Chat, then rest), removed
      Buckets link + unused IconMdiFilterVariant import.
- [x] admin/+page.svelte: reorder dashboard cards.
- [x] deleted site/src/routes/admin/buckets/ (page + stories).
- [x] Updated AGENTS.md route line (buckets folded into dictionaries description).
- [x] Added large-dataset `Paginated` stories to both pages + a `PaginatedPage2` interaction story.

## Verification ✅
- `pnpm check`: 0 errors. eslint: clean (only the repo-wide tolerated unused-callback-param warning).
- svelte-look: both Paginated stories render 100 rows/page + pagination bar "1–100 of 260"; page-2
  click navigates to "101–200 of 260" with correct rows + active button.
- Live puppeteer (admin L3, 420px viewport): `.table-wrap` overflow:auto + bounded max-height,
  scrollable, `thead` sticky top:0, and after scrolling 300px the thead top == wrap top (pinned).
  Nav reorder + no Buckets confirmed in the screenshot.

## Notes
- Only live link to /admin/buckets is admin/+layout.svelte nav; rest are docs/issues.
- Both pages already have `_page.stories.ts` — extend with many rows for verification.
