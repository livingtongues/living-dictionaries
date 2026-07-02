# Align LD's UI with the svelte-ui skill (post-uno restyle)

The 2026-06-12 uno drop was a **pixel-parity port** — the
legacy look was deliberately retained. This issue is the deliberate-restyle follow-up:
move the app to the design system described in `.claude/skills/svelte-ui/SKILL.md`
(minimal chrome, surface-based hierarchy, `.btn-*` buttons, mdi icons, invisible inputs)
and retire the uno-era captured-CSS shims. Read the skill first — it IS the spec.

Items are largely independent; suggested order = listed order (mechanical → design).
Each phase: convert route-by-route/batch, verify with svelte-look stories + :3041
screenshots (`site/e2e/uno-parity-shots.mjs` works for any whole-app visual pass).
Sibling: house's equivalent is `~/code/house/.issues/future/post-parity-styling-improvements.md`.

## 1. Replace the Font Awesome Kit (mechanical, glyph-identical — do first)

- 25 files of `<i class="fas fa-x">` / `<i class="far fa-x">` → identical-glyph
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

## 3. Adopt `.btn-*` for buttons

- Replace parity-styled raw buttons (scoped-CSS recreations of the old tailwind button
  recipes) with the global `.btn` / `.btn-outline` / `.btn-ghost` / `.btn-primary` +
  `btn-sm|default|lg` classes. For async actions, FIRST port tutor's `HeadlessButton.svelte`
  (LD doesn't have it — today the legacy `ui/Button.svelte` fills that role), then compose
  `btn-*` on its `class` prop.
- This changes the look (pill shape, press-scale) — deliberate restyle, batch by route.
- Also migrate usages of the vendored legacy `sp-*` svelte-pieces `Button` toward
  HeadlessButton + `.btn-*` (feeds phase 4's shim removal).

## 4. Retire the uno-era captured-CSS shims — ✅ MOSTLY DONE (2026-07-02 dark flip)

Done during the dark-mode flip: forms.css rewritten skill-styled on theme vars (element-level,
`.form-input` class deleted + stripped from call sites, native checkbox/radio via accent-color);
typography.css rewritten readable on theme vars; uno-preflights.css trimmed to ONLY the `--un-*`
var-init block; global.css select rule merged into forms.css. HeadlessButton is ported and in use.
Remaining below: the `--un-*` var-init block itself (blocked on modernizing the vendored sp-*
pieces) and the icons.css shim.

End-state: the global layer is just reset + theme + buttons + a small skill-styled forms/
typography layer — no verbatim uno dumps.

- **`uno-preflights.css`** — the `--un-*` var-init block exists ONLY because the vendored
  legacy `sp-*` svelte-pieces styles (Button/Modal/Menu…) compose
  `var(--un-ring-*)`/`var(--un-shadow)`. Modernize/replace those vendored components
  (port the current svelte-pieces from tutor), then delete the var-init block. The forms
  element preflights in the same file fold into a skill-styled forms layer.
- **`forms.css`** (`.form-input`, 16 call sites) — restyle inputs per the skill
  ("the content IS the interface": minimal chrome, transparent where possible,
  `::placeholder` in `--color-secondary`), or at minimum theme-var the existing class
  (the dark flip already forces the color literals onto vars).
- **`typography.css`** — the verbatim `tw-prose` dump serves 5 usage sites (about,
  grammar, EntryField/EditField rich text). Trim to what those actually need and restyle
  to skill standards; colors onto theme vars.
- **`icons.css`** (`.icon-inline` shim) — as icons get touched in phases 1-2, move their
  sizing/align to per-icon inline styles per the skill, then delete the shim. (Cross-repo
  context: tutor solves this with a forked reset — `svg { inline-block; middle }` — house
  with per-icon inline styles; unifying the strategy is logged in house's
  `post-parity-styling-improvements.md`.)
- **`reset-tailwind.css`** stays — it's a standard reset, not debt.

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
