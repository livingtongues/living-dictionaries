# Skill-align the dictionary info/tooling pages (about, grammar, contributors, import, export)

Bring these 5 `[dictionaryId]` pages fully in line with `.claude/skills/svelte-ui/SKILL.md`
(part of the broader `ui-skill-alignment.md` phases 1-3+5, scoped to these routes). Plus fix
the export "Download CSV" perpetual-spinner bug on empty dictionaries.

Decisions (interview with Jacob 2026-06-30):
- Q1 oneshot: do all 5 in one pass, build a svelte-look story per page, self-verify screenshots, present together.
- Q2 full: FA `<i>`→`~icons` (mdi), adopt `.btn-*`, theme-var hardcoded colors, minimal-chrome spacing.
- Q3 port: port tutor's `HeadlessButton.svelte` into LD svelte-pieces; use it + `.btn-*` for async buttons on these pages. Legacy `Button` stays elsewhere.
- Q4 hide: export with 0 entries → hide the controls (blank-ish, minimal note), AND hide the Export link in `SideMenu` when `entry_count === 0`.

## Export spinner root cause
`export/+page.svelte` button: `loading={!formattedEntries.length}`. With 0 entries, `ready` becomes
true but `formattedEntries` stays `[]` → `!length` permanently true → spinner forever. Conflates
"still loading" with "genuinely empty". Fix: convert the `run()` block to `$derived`, gate manager
export UI on `ready`, and when `ready && formattedEntries.length === 0` show a short muted note (no
controls). Hide the sidebar Export link when entry_count === 0.

## Plan / progress — ✅ COMPLETE

### Phase 0 — shared ✅
- [x] Ported `HeadlessButton.svelte` → `$lib/svelte-pieces/` + exported from `index.ts` (byte-parity with tutor's; uses `~icons/gg/spinner` + `~icons/tabler/external-link`).
- [x] `src/lib/mocks/mock-t.ts` — synchronous English `t` (first-period split + real `interpolate`).
- [x] `SideMenu.svelte` — Export link now gated on `entry_count > 0` (hidden for empty dicts).

### Phase 1 — about (+ UserGuide) ✅
- [x] `.btn-*` + HeadlessButton; `$app/stores`→`$app/state`. UserGuide: mdi chevrons, surface card, dropped the 2px border + `run()` JS-centering hack + `svelte/legacy`. `_page.stories.ts`.

### Phase 2 — grammar ✅
- [x] same button treatment. `_page.stories.ts`.

### Phase 3 — contributors (+ Citation, Partners) ✅
- [x] FA→mdi (email-outline/close/pencil-outline), `.btn-*`/HeadlessButton, danger deletes via `--danger` ghost buttons, citation `.unsaved`→`--warning`, `<hr>`→`.section-divider` (theme-var) + bigger heading spacing. `_page.stories.ts`.

### Phase 4 — import ✅
- [x] normalized hero heading to standard section heading, `.btn-primary`/`.btn`, FA comment→mdi message-outline. `_page.stories.ts`.

### Phase 5 — export (+ DownloadMedia, Progress) ✅
- [x] `run()`→`$derived`; **spinner bug fixed** (gate manager UI on `ready`, `loading={!ready}`); empty → "There are no entries to export yet." (no controls); `.btn-*`/HeadlessButton; FA check→mdi (green `--success`); notes→`--warning`/`--danger`; audio checkbox now `disabled` when 0 (parity w/ images); Progress colors→theme vars + `$effect`; DownloadMedia errors→`--danger`; `translate_entries` now takes `t`+`url_from_storage_path` (removed `get(page)` coupling). Stories: ManagerWithMedia / ManagerEmpty / NotManager / ManagerImagesSelected + Progress.stories.

## Verify ✅
- `pnpm check` 0 errors; `pnpm eslint` 0 errors (2 new warnings in ported HeadlessButton are the
  same function-type-param class already tolerated repo-wide / mirrors tutor); `pnpm test` 766 pass.
- All states screenshot-verified via svelte-look (light-only).

## Knowledge written
- `.knowledge/testing/svelte-look-page-stories.md` (the `$app/stores`-can't-SSR gotcha, `mock_t`,
  store-valued page data, CSV crash traps, tween timing).

## Follow-up: app-wide `$app/stores` → `$app/state` migration ✅
Jacob asked to clean up the deprecated `$app/stores` everywhere. Scope was clean:
- 84 files imported `{ page }` (ONLY page — no `navigating`/`updated`/`getStores` anywhere).
- Classification: 75 runes `.svelte` (safe mechanical), 8 `.ts` helpers (`get(page)`), 1 `.js` store.
- **75 `.svelte`**: `from '$app/stores'`→`'$app/state'`, `$page`→`page` (all runes-mode → reactivity
  equivalent; verified no local-`page` collisions, diffs purely page-related).
- **8 `.ts`** (vernacularName, media, inviteHelper, share, upload-image/video/audio, setUpColumns):
  `const {data} = get(page)` → `= page` (browser-only helpers; `get(page)` on `$app/stores` already
  only worked browser/component-init, so equivalent), dropped now-unused `get` import.
- **1 `.js` LEFT on `$app/stores` deliberately**: `svelte-pieces/stores/query-param-store.js` — its
  writable `start` notifier needs imperative `page.subscribe(...)` outside any component/effect;
  `$app/state` has no `.subscribe`. Commented in-file explaining why.
- Verify: `pnpm check` 0 errors, `pnpm test` 766 pass, `pnpm eslint` 0 errors.
</content>
