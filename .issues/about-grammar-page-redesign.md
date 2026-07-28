# About + Grammar page redesign (header rows, guidance modal, grammar TOC)

Jacob, 2026-07-28. Two dictionary pages get restructured. Real driver:
`https://livingdictionaries.app/ponca/grammar` — 59 sections, 77KB of prose, no way to navigate.

## Decisions (answered by Jacob)

| Question | Answer |
|---|---|
| Desktop TOC placement | **Right rail**, sticky, scroll-spy (left rail is already the dictionary SideMenu) |
| Mobile TOC | **Sticky "you are here" bar** under the header; tap → full TOC overlay |
| TOC depth | **Chapters only**; active chapter auto-expands to its subsections |
| Grammar edit toggle | Reveals **everything** — per-section controls, add buttons, "Edit clause slots" |
| Width caps | Removed on about prose + grammar sections block (Jacob's no-capped-prose rule) |
| Clause template | Full width of the content column; gets a TOC entry at the top |
| Ponca lone root | **Restructure the data** — the page heading IS the root; promote the 19 chapters |

## Work

### 1. About page ✅
- [x] `GuidanceList.svelte` extracted (just the `<ul>` of the 5 questions) — shared by the
      collapsible card and the modal.
- [x] Header row: `About` heading + `Edit` (pencil) + `Guidance` buttons on one line.
- [x] Not editing → Guidance opens a `Modal`. Editing → `UserGuide` collapsible card inline at
      the top, **full width** (its `max-width: 550px` is gone).
- [x] `max-width: 768px` removed from `.about-content` and the editor column; editing is a
      2-column split (editor | live preview), each `flex: 1`.

### 2. Grammar page ✅
- [x] Header row: `Grammar` heading + `Edit`/`Done` toggle (managers + admin-3 only).
      **Page loads in READ mode** — `edit_mode = $state(false)`.
- [x] Tree building lifted from `GrammarSectionsView` up to `+page.svelte` so the TOC and the
      section list share one `tree` (passed down as a prop).
- [x] `grammar-toc.ts` — pure derivation of TOC entries from the tree + scroll-spy → active
      chapter expansion. Unit-tested.
- [x] `GrammarToc.svelte` — the list itself (shared by rail + overlay).
- [x] `GrammarTocRail.svelte` — desktop `position: sticky; top: 3rem` right rail (≥1024px).
- [x] `GrammarTocBar.svelte` — mobile sticky bar (`top: 3rem`, under the 3rem header) showing
      the active chapter; tap → overlay.
- [x] `scroll-spy.svelte.ts` — IntersectionObserver over each section's `.head` element.
- [x] Width caps removed; clause-template strip spans the content column.

### 3. Untitled sections are no longer numbered ✅
`build_section_tree` now skips numbering for a **childless untitled** section (no title in any
language). That's the "preface" shape — the migrated-blob intro and Ponca's promoted root — so a
dictionary whose grammar is one blob no longer shows a stray "1" in front of it. Titled sections
number 1..N around it. Untitled sections WITH children still number normally (they're structural).

### 4. Ponca data restructure ✅ APPLIED TO PROD 2026-07-28 07:28 UTC
`scripts/one-off/2026-07-28-ponca-flatten-grammar-root.cjs` (dry-run by default, `APPLY=1` to write):
- 19 chapters promoted to `parent_id = NULL` (existing sort_keys `i`,`r`,`w`,… already sort right).
- The root row keeps its 1455-byte preface `body`, **loses its title** ("Notes on Ponca
  Pronunciation and Grammar" is redundant with the page heading), and takes `sort_key = '9'`
  (`key_between(null, 'i')`) so it stays first.
- `updated_at` bumped, `dirty` NEVER set (server-side rule).

Applied result (verified in prod): 20 top-level sections — the unnumbered preface then
`1 PRONUNCIATION GUIDE` … `19 PONCA NUMERICAL SYSTEM`, subsections intact at `6.1`, `10.4`, etc.
`integrity_check: ok`, 0 rows marked `dirty`, `server_seq` bumped on all 20. Backup taken first
(`ponca.db.bak-20260728-072757` **+ its `-wal`** — a plain `cp` of a WAL-mode DB without the WAL
file is NOT a complete backup). `dictionaries.updated_at` bumped so the R2 snapshot builder
rebuilds; per-dict writes reach browsers via that snapshot (~30 min), not sync.

## Gotchas found along the way
- The dictionary layout (`[dictionaryId]/+layout.svelte`) already owns the left rail
  (`.side-panel`, 11–12rem, sticky `top: 3rem`) — that's why the TOC went right.
- Sections nest their children INSIDE the parent's `.section` div, so a whole-section
  IntersectionObserver reports the parent visible whenever any child is. The fix isn't to observe
  headings — it's the "last landmark above the line in DOCUMENT ORDER" rule, which makes nesting
  work for free (see `.knowledge/domain/grammar-page-navigation.md`).
- Header is `position: sticky; top: 0; height: 3rem` → every sticky offset here is `3rem`, and
  sections need `scroll-margin-top` (7rem narrow / 4rem ≥1024px, clearing the mobile TOC bar too)
  so anchor jumps don't hide under it.
- `eslint svelte/prefer-svelte-reactivity` bans a bare `Map` even for deliberately NON-reactive
  internal bookkeeping — a plain object sidesteps it without an inline disable.
- svelte-look `interactions` screenshot before transitions settle; `waitForSelector` then a ~400ms
  sleep for anything with a fade/slide.

## Verified
- `pnpm test` (2269 passed), `pnpm check` (0 errors), `pnpm lint` clean.
- svelte-look: about (Viewer / ManagerWithContent / ManagerEmpty / GuidanceModal / ManagerEditing)
  + grammar (Viewer / ManagerSections / ManagerEditing / ManagerProse / BookDesktop /
  BookDesktopScrolled / BookMobile / BookMobileTocOpen), light AND dark.
- Headless browser against `localhost:3041` on a 36-section seeded `dev` dictionary: desktop rail
  scroll-spy + auto-expand, mobile bar + overlay, About read/modal/edit — no page errors.
