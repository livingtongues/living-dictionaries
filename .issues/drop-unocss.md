# Convert the app to scoped CSS, then drop UnoCSS

**STATUS: ✅ DONE 2026-06-12 — all ~80 files converted with pixel parity AND the flip executed:
UnoCSS is fully removed (plugin, config, 6 deps). Verified: check 0 errors, 409 tests, lint,
build, achi-flow e2e, 18/23 routes pixel-identical post-flip (rest = known flake). Uncommitted —
awaiting Jacob's eyeball on :3041. Follow-up moved to its own issues:
`.issues/dark-mode-flip.md` + `.issues/ui-skill-alignment.md`.**

Rewritten 2026-06-12 from `app-group-removal-and-global-theme.md` (deleted — its theme-promotion
phase shipped 2026-06-05: `theme.css`/`buttons.css` global, light-forced, `archive/css/reset.css`
archived; the headers of those files document it). This file is ONLY the remaining uno-drop plan.
Sibling plan: house `.issues/theme-app-wide-and-drop-uno.md` (same playbook, adapted); finished
reference: tutor commit `7e3bc7f0` + its `.issues/strip-unocss-from-site.md` (read it before
starting — the lessons-learned section is gold).

## Decisions (locked with Jacob 2026-06-12)

- **One pass per file**: when a file is touched, fully convert it (uno utilities → scoped
  CSS/inline styles, `@apply` expanded, `i-*` icons swapped). Uno stays installed until the last
  file, then one final flip removes it.
- **Pixel-parity refactor**: match the current look. Deliberate restyling is out of scope — log
  wants under "Post-parity improvements" below.
- **Icons — do NOT change any glyphs this pass.** LD has THREE icon systems:
  1. `~icons/*` unplugin-icons components (31 files, the admin port) — already the target system,
     untouched.
  2. uno presetIcons `i-*` classes (53 files, ~60 unique icons across many collections) — these
     DIE with uno, so swap each to its **identical** unplugin-icons component (tutor's method:
     both read `@iconify/json`, so `i-fa-solid-times` → `~icons/fa-solid/times` is the exact same
     SVG — a mechanism swap, not an icon change). Keep the original collection (no mdi
     unification now).
  3. **Font Awesome Kit** (`kit.fontawesome.com` script in `src/app.html`; 25 files with
     `<i class="fas fa-x">`) — **KEEP untouched**, kit script stays at the flip (it's independent
     of uno). Replacing it is a logged future improvement.
- **Dark-ready, dark off**: converted components use theme vars only (no hardcoded grays — map to
  the nearest semantic var); the system `prefers-color-scheme` block in `theme.css` stays
  commented out. Dark flip is a separate later step (see bottom).
- **Font stack unchanged**: LD's `--font-sans` (Segoe UI/Arial/Noto) is a deliberate
  diacritics-safe stack (Mac Chrome `.SF NS` stacks diacritics on dotted-i) — never "upgrade" it
  to Inter/system-ui. Rationale in `theme.css` + `global.css` headers.
- **`form-input` shortcut** (16 files): unlike house's expand-inline decision, define ONE global
  plain-CSS `.form-input` class (new `src/lib/forms.css`, imported in root layout next to
  `buttons.css`) — capture the shortcut's expanded CSS (incl. uno's `--un-ring*` focus shadow)
  verbatim from uno's generated output. 16 call sites keep their markup; DRY.

## Current state (verified 2026-06-12)

- `theme.css` (global vars + body paint + `--font-sans`) and `buttons.css` (global `.btn-*`) are
  plain CSS, app-wide, light-forced. `archive/css/reset.css` holds the verbatim plain copy of
  uno's reset for the flip.
- Root `+layout.svelte` import order: `./reset.css` → `virtual:uno.css` → `$lib/theme.css` →
  `$lib/buttons.css` → `./global.css`. `src/routes/reset.css` is
  `@import '@unocss/reset/tailwind.css' layer(reset)` — the cascade layer fixes
  equal-specificity ties vs component styles (header comment explains; KEEP the layer at flip).
- `uno.config.ts`: presetUno, **presetForms (global form preflights!)**, presetTypography
  (`tw-prose`, safelisted), presetIcons (`i-*` with extraProperties
  `display:inline-block; vertical-align:middle`), `screens.print` (`print:` variant),
  `form-input` shortcut, extractorSvelte (`class:utility={cond}`), transformerDirectives
  (`@apply`).
- unplugin-icons is ALREADY wired: `Icons({ compiler: 'svelte' })` in `vite.config.ts`,
  `/// <reference types="unplugin-icons/types/svelte" />` in `app.d.ts`, `@iconify/json`
  installed. No foundation work needed (unlike tutor's Phase 0).
  **Gotcha staged**: `vitest.config.ts` does NOT have the Icons plugin — the moment a
  test-imported component uses `~icons/*`, unit tests break (tutor hit this; add
  `Icons({ compiler: 'svelte' })` to vitest config plugins when it happens or pre-emptively at
  the flip).
- Scale: 221 `.svelte` files; ~115 use utilities (grep heuristic — treat the inventory below as
  approximate, the final sweep is authoritative); 9 `@apply`; 5 `tw-prose`; 16 `form-input`;
  8 `print:`-variant files; `lib/svelte-pieces/` is already scoped-CSS (example-repo port, clean).
- No uno outside `/site` (scripts + cf-worker clean) — single-package teardown.
- svelte-look: only **13 stories** → per-file verification leans on browser screenshots of the
  dev site (:3041) more than stories. Same SSR/CSR split as house:
  `svelte-look.config.ts` `css_imports` (`@unocss/reset/tailwind.css`, `virtual:uno.css`) only
  load for **CSR** screenshots → use `csr: true` for before/after parity while uno is in.
  `dark_mode: false` stays.

## Conversion conventions (per the svelte-ui skill)

- Utilities → inline `style="…"` for simple one-element styling; scoped `<style>` class when
  pseudo-classes/media queries/semantic naming/repetition warrant. Keep exact rem values
  (`p-4`=1rem, `text-sm`=.875rem/1.25rem line-height, …).
- Variant prefixes: `sm:`→`@media (min-width: 640px)`, `md:`→768px, `lg:`→1024px,
  `hover:`/`focus:`/`disabled:`→pseudo-classes, `print:`→`@media print` (uno theme defines the
  `print` screen — 8 files use it, mostly the entries print view + shell).
- Color mapping (dark-ready, parity-approximate; recipes vs white bg):
  - `text-gray-900`/`-800` → `var(--color)`; `text-gray-500` → `var(--color-secondary)`
  - `text-gray-700` → `color-mix(in srgb, var(--color) 85%, var(--background))`;
    `-600` → 75%; `-400` → 45%
  - `bg-white` → `var(--background)`; `bg-gray-100` → `var(--surface)`;
    `bg-gray-200`/`hover:bg-gray-200` → `color-mix(in srgb, var(--background), var(--color) 10%)`
  - default 1px borders (reset `#e5e7eb`) → `1px solid var(--border-color)`;
    `border-gray-300` → `color-mix(in srgb, var(--background), var(--color) 18%)`
  - `blue-500` → `var(--primary)` (EXACT: `hsl(217,91%,60%)` == `#3b82f6`); other blues →
    color-mix from `--primary`. `red-*` → `var(--danger)` family.
  - If a mix recurs everywhere, promote it to a theme var (log it).
- Icons (`i-*` only — FA kit untouched):
  - `i-<set>-<name>` → `import IconX from '~icons/<set>/<name>'` + `<IconX />`. Colon form
    (`i-tabler:ai`, `i-mage:facebook-square`, `i-heroicons:backspace-20-solid`) → slash after the
    set: `~icons/tabler/ai`.
  - Parity watch: presetIcons added `display:inline-block; vertical-align:middle` to every icon;
    unplugin-icons SVGs are 1.2em-square with NO vertical-align → add
    `style="vertical-align: middle"` (or per-icon `font-size`) where screenshots show drift.
  - Sizing/spacing on icons: prefer inline `style="…"` on the component (tutor lesson #6).
  - `class:i-x={cond}` toggles and icon classes in `.ts` files (grep both) need the
    two-components-with-`{#if}` pattern.
- `@apply`/`--at-apply` blocks (9 files): inline the expanded CSS during that file's conversion.
- `tw-prose` (5 files): LEAVE in place; covered by archived typography CSS at flip.
- Email components (`routes/api/email/components/`): mostly own inline/client-specific CSS;
  only `BaseLayout.svelte` grepped positive — convert carefully and verify rendered HTML output
  (emails don't load app stylesheets; any uno class there is likely already dead — confirm).
- Verify each file: story exists → CSR svelte-look before/after; else browser screenshot on
  :3041 before/after. `pnpm check` + lint per batch. Component/e2e tests selecting on `.i-*`
  classes → switch selectors to semantic classes/aria-labels (tutor did this in chat tests).

## Verification harness (built 2026-06-12)

- `site/e2e/uno-parity-shots.mjs` — 23 screenshots of the main routes against the dev server
  (:3041): logged-out pages, auth modal, all achi dictionary views (list/table/gallery/print,
  entry detail, about/contributors/settings/export/import/grammar/synopsis), narrow variants.
  `node e2e/uno-parity-shots.mjs <out_dir> [name-prefix,…]`. Diff with
  `compare -metric AE -fuzz 2% baseline/x.png after/x.png diff/x.png`.
- Rolling baseline at `/tmp/uno-parity/baseline` (currently = post-phase-1 verified state).
  Home globe (Mapbox tiles) is flaky — eyeball it. `googleusercontent.com` is blocked in the
  script (avatars ERR_BLOCKED_BY_ORB intermittently → deterministic fallback instead).
- `archive/css/uno-generated-dev-dump.css` — full uno dev CSS dump (preflights + forms +
  tw-prose + all utilities) captured from the live page; reference for exact utility values.
- New global CSS added: `src/lib/forms.css` (`.form-input` plain-CSS, resolved from the
  shortcut) + `src/lib/icons.css` (`.icon-inline` presetIcons-parity shim:
  inline-block/1em/1em/vertical-align-middle — the reset blocks bare svg!). Both imported in
  root layout + svelte-look `css_files`.

## File inventory (convert + verify each; ✅ when done)

Heuristic-derived; when touching a file convert it FULLY even if listed for one reason. Files
with `(FA)` also contain FA-kit `<i>` tags — leave those tags alone.

### 1. Shared shell + ui + root — ✅ DONE 2026-06-12 (parity-verified: 0px diffs on tutorials/about/terms/dictionaries; residuals = blocked avatar + focus caret + random test string; check 0 errors)
- ✅ lib/components/shell/Header.svelte (print:, FA)
- ✅ lib/components/shell/Footer.svelte (print:)
- ✅ lib/components/shell/UserMenu.svelte (FA)
- ✅ lib/components/shell/User.svelte (FA)
- ✅ lib/components/shell/ViewAsBanner.svelte (print:)
- ✅ lib/components/shell/AuthModal.svelte
- ✅ lib/components/ui/AdminGuard.svelte
- ✅ lib/components/ui/Autocomplete.svelte (form-input)
- ✅ lib/components/ui/VirtualList.svelte
- ✅ lib/components/ui/array/ModalEditableArray.svelte
- ✅ lib/components/ui/array/MultiSelect.svelte
- ✅ lib/components/Filter.svelte (@apply)
- ✅ routes/+error.svelte
- ✅ routes/+layout.svelte (added forms.css/icons.css imports) — LoadingIndicator was already scoped CSS; global.css scrollbar var-ing deferred to the dark flip

### 2. Home + dictionary catalog — ✅ DONE 2026-06-12 (home/auth-modal/dict-about/entries-list 0px diffs; create-dictionary residual = random Test{timestamp} name)
- ✅ routes/+page.svelte (i-*)
- ✅ routes/Banner.svelte (i-*)
- ✅ lib/components/home/Search.svelte (form-input)
- ✅ lib/components/home/SearchDictionaries.svelte (form-input)
- ✅ lib/components/home/SelectedDict.svelte (FA)
- ✅ lib/components/home/MyDictionaries.svelte
- ✅ routes/dictionaries/+page.svelte (@apply, FA)
- ✅ routes/create-dictionary/+page.svelte (form-input, FA)

### 3. Entries tree (the workhorse — biggest cluster) — ✅ DONE 2026-06-12 (parity verified: chip/icon geometry measured identical; residual AE = dev-server-swap AA ghosting — proven by untouched pages drifting equally + 0-diff re-runs; settings flake = Mapbox tiles. Rolling baseline rebased → /tmp/uno-parity/baseline2, taken against MY dev server post-phase-3)
- ✅ routes/[dictionaryId]/+layout.svelte (print:, FA)
- ✅ routes/[dictionaryId]/SideMenu.svelte (@apply)
- ✅ routes/[dictionaryId]/EditString.svelte (form-input)
- ✅ routes/[dictionaryId]/entries/+page.svelte (print:)
- ✅ routes/[dictionaryId]/entries/AddEntry.svelte
- ✅ routes/[dictionaryId]/entries/ClearFilters.svelte (FA)
- ✅ routes/[dictionaryId]/entries/SearchInput.svelte (form-input)
- ✅ routes/[dictionaryId]/entries/EntryFilters.svelte (print:)
- ✅ routes/[dictionaryId]/entries/FilterList.svelte (form-input)
- ✅ routes/[dictionaryId]/entries/ToggleFacet.svelte
- ✅ routes/[dictionaryId]/entries/View.svelte (entry modal class → `:global(div.entry-overlay-modal)`)
- ✅ routes/[dictionaryId]/entries/SwitchView.svelte (@apply)
- ✅ routes/[dictionaryId]/entries/Pagination.svelte (print:)
- ✅ routes/[dictionaryId]/entries/PaginationButtons.svelte (@apply)
- ✅ routes/[dictionaryId]/entries/components/Audio.svelte
- ✅ routes/[dictionaryId]/entries/components/Video.svelte
- ✅ routes/[dictionaryId]/entries/list/ListEntry.svelte
- ✅ routes/[dictionaryId]/entries/gallery/GalleryEntry.svelte (EntriesGallery.svelte was already scoped CSS)
- ✅ routes/[dictionaryId]/entries/table/EntriesTable.svelte
- ✅ routes/[dictionaryId]/entries/table/Cell.svelte
- ✅ routes/[dictionaryId]/entries/table/ColumnTitle.svelte
- ✅ routes/[dictionaryId]/entries/table/ColumnAdjustSlideover.svelte (divid-gray-200 was a typo generating nothing)
- ✅ routes/[dictionaryId]/entries/table/cells/PhotoCell.svelte
- ✅ routes/[dictionaryId]/entries/table/cells/SelectSpeakerCell.svelte
- ✅ routes/[dictionaryId]/entries/table/cells/Textbox.svelte
- ✅ routes/[dictionaryId]/entries/EntriesPrint.svelte (form-input, print:)
- ✅ routes/[dictionaryId]/entries/print/PrintEntry.svelte
- ✅ routes/[dictionaryId]/entries/print/PrintFieldCheckboxes.svelte

### 4. Entry detail — ✅ DONE 2026-06-12 (entries-list 0px; entry-detail residual = gray-500→color-secondary label mapping, sub-perceptual per locked decision)
- ✅ routes/[dictionaryId]/entry/[entryId]/+page.svelte (FA)
- ✅ routes/[dictionaryId]/entry/[entryId]/EntryDisplay.svelte
- ✅ routes/[dictionaryId]/entry/[entryId]/EntryField.svelte (tw-prose stays)
- ✅ routes/[dictionaryId]/entry/[entryId]/EntryMedia.svelte
- ✅ routes/[dictionaryId]/entry/[entryId]/EntrySentence.svelte
- ✅ routes/[dictionaryId]/entry/[entryId]/GeoTaggingModal.svelte
- ✅ routes/[dictionaryId]/entry/[entryId]/Sense.svelte

### 5. lib media + edit components — ✅ DONE 2026-06-12 (entry-detail/dict-import/entries 0px; residuals = Test{timestamp} + Mapbox tile flake)
- ✅ lib/components/audio/{EditAudio (FA), RecordAudio, SelectAudio (@apply, FA), UploadProgressBarStatus (FA), Waveform}.svelte
- ✅ lib/components/image/{AddImage, EditImage (form-input, FA), Image, Image2, ImageDropZone (@apply), UploadImageStatus}.svelte
- ✅ lib/components/video/{AddVideo (FA), PasteVideoLink (form-input, FA), PlayVideo (FA), RecordVideo (FA), SelectVideo (@apply, FA), VideoThirdParty}.svelte
- ✅ lib/components/media/{AddSpeaker, SelectSpeaker}.svelte (form-input ×2)
- ✅ lib/components/maps/CoordinatesModal.svelte (form-input)
- ✅ lib/components/maps/mapbox/{controls/ToggleStyle, map/Map, static/MapboxStatic}.svelte
- ✅ lib/components/entry/EditField.svelte (@apply, tw-prose stays, form-input)
- ✅ lib/components/entry/{EntrySemanticDomains, EntrySource}.svelte
- ✅ lib/components/settings/{EditableAlternateNames, EditableGlossesField, PrintAccessCheckbox, PublicCheckbox, WhereSpoken}.svelte
- ✅ lib/components/keyboards/{ipa/IpaKeyboard, keyman/Keyman}.svelte
- ✅ lib/components/modals/Contact.svelte (form-input, FA)
- ✅ lib/components/modals/SelectLanguage.svelte (FA)
- ✅ lib/components/contributors/ContributorInvitationStatus.svelte
- ✅ lib/export/Progress.svelte

### 6. Remaining [dictionaryId] routes — ✅ converted 2026-06-12 (check green; `prose-lg` was a dead class — selectorName is tw-prose; `text-gray-5` = uno shorthand for gray-500)
- ✅ routes/[dictionaryId]/about/+page.svelte (tw-prose stays) + about/UserGuide.svelte
- ✅ routes/[dictionaryId]/contributors/{+page (FA), Citation (form-input), Partners (FA)}.svelte
- ✅ routes/[dictionaryId]/export/{+page (FA), DownloadMedia}.svelte
- ✅ routes/[dictionaryId]/grammar/+page.svelte (tw-prose stays)
- ✅ routes/[dictionaryId]/import/+page.svelte (FA)
- ✅ routes/[dictionaryId]/invite/[inviteId]/+page.svelte (FA)
- ✅ routes/[dictionaryId]/settings/+page.svelte
- ✅ routes/[dictionaryId]/synopsis/{+page, DisplayString, VisualMap}.svelte

### 7. Misc routes — ✅ DONE 2026-06-12 (about/terms/account 0px or sub-perceptual; tutorials residual = YouTube embed flake)
- ✅ routes/about/+page.svelte
- ✅ routes/account/+page.svelte
- ✅ routes/terms/+page.svelte — NOTE: a concurrent session replaced this page with
  `LegalPage.svelte` + markdown (`marked` dep, new privacy-policy route) DURING this work; their
  version is already uno-free (scoped `.legal-content`), so no conflict.
- ✅ routes/tutorials/+page.svelte

### 8. Admin stragglers — ✅ N/A (heuristic false positives: those files already use semantic scoped classes + global `.btn-*`)

### 9. Email — ✅ N/A (BaseLayout + components use semantic classes + inline email CSS, not uno)

## The final flip — ✅ DONE 2026-06-12

1. ✅ Captured from the dev dump (`archive/css/uno-generated-dev-dump.css`):
   - `src/lib/uno-preflights.css` — the `--un-*` var initializers (`*,::before,::after` +
     `::backdrop`) **+ presetForms element preflights**, verbatim. CRITICAL: the vendored legacy
     svelte-pieces (`sp-*` pre-compiled styles in ui/Button, Modal, Menu, …) reference the
     `--un-ring-*`/`--un-shadow` vars — this file must stay loaded or their shadows break.
   - `src/lib/typography.css` — the `tw-prose` rules verbatim (uses CSS nesting — fine in
     modern browsers; probed post-flip: color/max-width/margins/headings all correct).
   - `.form-input` was already in `src/lib/forms.css` (resolved-var version). The `container`
     shortcut output was unused.
2. ✅ Root layout: `virtual:uno.css` → `$lib/uno-preflights.css` + `$lib/typography.css`.
   `reset.css` now imports `./reset-tailwind.css` (verbatim STOCK `@unocss/reset/tailwind.css`
   v66.7.0) inside `layer(reset)`. GOTCHA: the example repo's `archive/css/reset.css` is NOT
   stock — it adds font-smoothing + `svg{display:inline-block}`; deliberately skipped for parity
   (archive header updated to say so).
3. ✅ FA kit script stays in `app.html`.
4. ✅ uno plugin removed from `vite.config.ts`; `uno.config.ts` deleted; 6 uno deps dropped;
   `@iconify/json` + `unplugin-icons` kept.
5. ✅ vitest needed NO Icons plugin (LD has no component tests; `includeSource` is .ts only —
   409 tests pass).
6. ✅ `svelte-look.config.ts`: `css_imports` removed; `css_files` = reset-tailwind +
   uno-preflights + typography + theme + buttons + forms + icons + global. **Removed
   `csr: true` from UserMenu + ViewAsBanner stories — SSR renders scoped CSS correctly now**
   (verified by screenshot). `admin/schema` keeps csr (xyflow needs the browser).
7. ✅ Grep sweep clean; `pnpm check` 0 errors; `pnpm test` 409 pass; `pnpm lint` clean (after
   one autofix); `pnpm build` exit 0.
8. ✅ Visual: post-flip full parity run vs pre-flip — **18/23 routes 0px**, rest = known flake
   (YouTube embeds, Mapbox tiles, firebase logo, Test{timestamp}) + the concurrent terms
   rewrite. tw-prose computed-style probe ✓. `achi-flow` deep editor e2e PASSES end-to-end
   (login → list → overlay edit → add/delete sense → server persistence).
9. ✅ AGENTS.md styling section + svelte-ui skill updated. House cross-ref already points here.
   ✅ Shared-conventions blurb (otter `claude/WEB.md`) updated 2026-06-12 (house + LD both off uno).

## Dark flip — moved to `.issues/dark-mode-flip.md`

## Post-parity improvements — moved to `.issues/ui-skill-alignment.md`

## Regression found post-flip (fixed 2026-06-12)

- The flip dropped uno's on-demand `.animate-spin` utility, silently breaking the admin
  loading spinners (AssigneeDropdown, admin/sync, reply-composer — transient states the
  parity screenshots can't catch). Restored as a global class + `@keyframes spin` in
  `buttons.css` (house's recipe); verified via live computed-style probe on :3041.

## Pre-existing issues found (not caused by this work)

- `pnpm -F site test:entries` (e2e/entries-sqlite.mjs) is STALE: it fetches
  `/api/dictionaries/[id]/entries-data`, an endpoint removed by commit `bacef8a7` ("Remove
  Supabase entirely…"). Needs a rewrite against the snapshot read path — out of scope here.
- e2e known-external error filters were missing the Google One Tap GSI noise ("Not signed in
  with the identity provider" / FedCM in headless) — added to catalog + entries filters.
- `SyncStatus.svelte` has unused `.sync-icon` selectors (classes passed to an icon component
  need `:global`) — untouched, pre-existing.

## Lessons learned

- **`.icon-inline` shim must mirror presetIcons exactly**: `display:inline-block` (the reset
  blocks bare `svg`), `height:1em; width:auto` (width:auto preserves each icon's aspect ratio —
  fa-solid icons are 0.88em wide; forcing 1em stretched them), `vertical-align:middle`.
- **Class props passed INTO components** (svelte-pieces Button/Modal/Menu/AddEntry…) can't be
  svelte-scoped: use `:global(.semantic-name)` under an ancestor scope; for PORTALED components
  (Modal/Menu) ancestor scoping doesn't work either → bare `:global(div.unique-name)` with an
  element qualifier to outrank the component's own styles.
- **Declaration-order ties**: when two uno utilities set the same property (`text-sm` +
  `leading-4`, `rounded-none` + `rounded-r-md`, `relative` + `sticky`), the LATER rule in uno's
  generated output wins — check `archive/css/uno-generated-dev-dump.css` positions, don't guess
  from markup order. (house hit the same with `leading-normal` vs `text-3xl`.)
- **Dead classes existed in the old markup**: `focus:shadow-outline-blue` (tailwind-v1 name),
  `prose-lg` (selectorName is tw-prose), `divid-gray-200` (typo), `hover:text-gray:800` (typo) —
  all generated nothing; dropped with comments.
- **uno shorthand**: `text-gray-5` = gray-500; `i-set:name` colon form = `~icons/set/name`.
- **Parity screenshot gotchas**: (a) restarting the dev server subtly changes text AA across the
  whole page (fuzz-2% diffs everywhere) — rebase the baseline against the same server instance;
  (b) `pnpm check` runs `svelte-kit sync` which triggers a full-reload storm that hangs
  concurrent puppeteer `goto`s — never run them in parallel; (c) block
  `googleusercontent.com` (avatars ERR_BLOCKED_BY_ORB intermittently) for determinism;
  (d) Mapbox tiles / YouTube embeds / firebase images flake — eyeball those regions.
- **e2e selectors on `i-*` icon classes break at conversion** (tutor lesson confirmed):
  achi-flow/db-ops-flow selected buttons via `innerHTML.includes('i-system-uicons-versions')` —
  switched to semantic classes (`.add-sense-button`, `.delete-sense-button`).
- The `--un-*` var-init preflight is load-bearing beyond utilities: vendored `sp-*` styles and
  the exact-parity focus-ring recipes compose `var(--un-ring-offset-shadow), var(--un-ring-shadow),
  var(--un-shadow)`.
- `site/e2e/uno-parity-shots.mjs` is kept — reuse it for the dark flip (and any future
  whole-app visual refactor).
