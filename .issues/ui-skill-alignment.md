# Align LD's UI with the svelte-ui skill (post-uno restyle)

The 2026-06-12 uno drop was a **pixel-parity port** — the
legacy look was deliberately retained. This issue is the deliberate-restyle follow-up:
move the app to the design system described in `.claude/skills/svelte-ui/SKILL.md`
(minimal chrome, surface-based hierarchy, `.btn-*` buttons, mdi icons, invisible inputs)
and retire the uno-era captured-CSS shims. Read the skill first — it IS the spec.

## Session progress (2026-07-12)

- ✅ Phase 4 DONE: reset-tailwind.css forks `svg { inline-block; middle }` (tutor-shared),
  vite `Icons({ scale: 1 })` (icons = 1em, skill statement now true), all 188 `icon-inline`
  classes stripped (3 style blocks now select `:global(svg)`), icons.css deleted (+ layout
  import + svelte-look css_files entry). Screenshot-verified home/entries/admin/dict-home.
- ✅ Phase 1 DONE: all 47 FA `<i>` tags across 20 files → `~icons/fa-*` components
  (codemod: /tmp/fa-codemod.mjs). Kit was FA **Pro 5.15.4** — Pro-only regular glyphs
  (info-circle, donate, times, bars, sign-in→sign-in-alt, key, undo, spinner,
  pencil→pencil-alt, link, language, film-alt→film, upload, check) provisionally use
  **fa-solid**; free-regular kept for question-circle/trash-alt/comment. `fa-lg`→
  font-size:1.3333em, `fa-sm`→0.875em, `fa-pulse`→animate-spin, `fa-fw` dropped.
  Kit script REMOVED from app.html. Jacob will pick final glyphs on /admin/icon-review.
- Phase 2 DELETED by Jacob (no mdi unification pass).
- ⏳ /admin/icon-review page (level 3): Pro original (page injects kit itself) vs
  fa-solid vs mdi-outline, tap-select, Jacob screenshots back after next push.
  DELETE the page after picks are applied.
- ⏳ Phase 3 buttons: Jacob chose MINIMAL mapping — only 1-2 btn-primary CTAs per page,
  everything else btn-ghost/plain btn.
- ⏳ Wrap-up: phase 5 → own issue, delete this file, AGENTS.md update.

Items are largely independent; suggested order = listed order (mechanical → design).
Each phase: convert route-by-route/batch, verify with svelte-look stories + :3041
screenshots (`site/e2e/uno-parity-shots.mjs` works for any whole-app visual pass).
Sibling: house's equivalent is `~/code/house/.issues/future/post-parity-styling-improvements.md`.

Already done (details in git/past issue revisions): uno-preflights.css deleted, all `--un-*`
vars gone, `ui/Menu.svelte` deleted, forms.css + typography.css rewritten skill-styled on
theme vars (`.form-input` class gone), HeadlessButton ported and in use, dark mode live.

## 1. Replace the Font Awesome Kit (mechanical, glyph-identical — do first)

- 20 files / 47 tags of `<i class="fas fa-x">` / `<i class="far fa-x">` → identical-glyph
  `~icons/fa-solid/*` / `~icons/fa-regular/*` components (same `@iconify/json` source —
  exact same SVGs; the proven presetIcons-swap method from the uno drop).
- **Icon-swap mechanics** (inlined from the retired drop-unocss.md so they aren't lost):
  - `i-<set>-<name>` → `import IconX from '~icons/<set>/<name>'`; colon form
    (`i-tabler:ai`) → slash after the set (`~icons/tabler/ai`).
  - **`.icon-inline` shim must mirror presetIcons exactly**: `display:inline-block` (the reset
    blocks bare `svg`), `height:1em; width:auto` (width:auto preserves aspect — fa-solid icons are
    ~0.88em wide; forcing 1em stretches them), `vertical-align:middle`. unplugin-icons SVGs are
    1.2em-square with NO vertical-align, so add `vertical-align:middle` where screenshots drift.
  - **Class props passed INTO components** (svelte-pieces Button/Modal/Menu, AddEntry…) can't be
    svelte-scoped → `:global(.semantic-name)` under an ancestor scope; for **PORTALED** components
    (Modal/Menu) ancestor scoping fails too → bare `:global(div.unique-name)` element-qualified to
    outrank the component's own styles.
  - **Conditional icons** (`class:i-x={cond}` toggles, icon classes referenced in `.ts` files) →
    the two-components-with-`{#if}` pattern.
- Then delete the `kit.fontawesome.com` script from `src/app.html` — removes a
  third-party blocking script (perf win) + the FOUC of font-glyph icons.
- Was explicitly deferred by Jacob during the parity pass; greenlit as follow-up.
- Update AGENTS.md styling note (it documents the FA kit as a logged improvement).

## 2. Unify icon collections on mdi

- Skill: prefer `mdi` unless another collection is markedly better. The parity pass kept
  every original collection (fa/fa6/ic/carbon/tabler/heroicons/mage/system-uicons/…).
- This one DOES change glyphs — go view-by-view with before/after screenshots, picking
  the nearest mdi equivalent. Combine with phase 1 where convenient (an FA `<i>` being
  touched anyway can jump straight to mdi).

## 3. Adopt `.btn-*` for buttons / retire legacy `ui/Button.svelte`

(Absorbed from the retired `.issues/button-retirement.md`, 2026-07-12.)

Jacob (2026-07-04) wants the legacy vendored `ui/Button.svelte` (own `form`/`size`/`color` API,
compiled sp-* styles) gone and buttons modernized, BUT not as one giant hard-to-review UI change.
His stated taste: **"I really like the clean look of buttons without any background or border,
just a slight hover change"** — i.e. the ghost/text style, minimal chrome. Scope: LD has ~54
files importing it; house ~13 (mirror there afterwards with the same variant map). Replacement:
`HeadlessButton` (already ported and in use) + global `.btn-*` classes, leaning `btn-ghost`-like.

Execution strategy:
1. **Inventory by variant**: map every call site's `form=` (`filled|outline|text|simple|menu`) ×
   `color` × `size` to its nearest `.btn-*` equivalent. Many `form="text"`/`form="simple"` sites
   are already Jacob's preferred look — those migrate with near-zero visual delta and go FIRST.
2. **Batch by route/section** (one reviewable chunk each, svelte-look/e2e screenshots per batch):
   admin area (internal, lowest risk) → header/shell → entries UI → settings/about pages.
3. Genuinely filled CTA sites → `btn-primary`; deliberate restyle, flag per batch for Jacob.
4. Temporary lint guard (`no-restricted-imports` on `ui/Button.svelte`) once a section is
   migrated to stop regressions; delete the component + its compiled styles at the end
   (self-contained — no `--un-` vars).
- This changes the look (pill shape, press-scale) — deliberate restyle, batch by route.

## 4. Delete the last uno-era shim: `icons.css`

- **`icons.css`** (`.icon-inline` shim) — as icons get touched in phases 1-2, move their
  sizing/align to per-icon inline styles per the skill, then delete the shim. (Cross-repo
  context: tutor solves this with a forked reset — `svg { inline-block; middle }` — house
  with per-icon inline styles; unifying the strategy is logged in house's
  `post-parity-styling-improvements.md`.)
- **`reset-tailwind.css`** stays — it's a standard reset, not debt.
- End-state: the global layer is just reset + theme + buttons + the skill-styled forms/
  typography layers — no verbatim uno dumps.

## 5. Minimal-chrome restyle pass (the big one)

- Surface-based hierarchy: replace gratuitous borders/dividers with `--surface` vs
  `--background` shifts; cards per the skill recipe (no border, 0.75rem radius,
  press-scale); generous spacing values from the skill.
- Promote recurring `color-mix` recipes from the parity conversion into named theme vars
  (the conversion log flagged this: gray-700/600/400 mixes recur widely).
- Biggest legacy surfaces to hit: entries table + filters, entry editor modals, settings
  forms, contributors/export/import pages, home search.
- Route-by-route with Jacob's eyeball — this is taste work, not parity work.

## 6. Grow svelte-look coverage as you go

- Only ~13 stories exist. Each restyled component/route should gain a story so phase
  verification (and the dark-mode audit) stays cheap.
