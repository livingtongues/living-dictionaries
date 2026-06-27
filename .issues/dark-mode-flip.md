# Turn on dark mode (system preference + user toggle)

The final phase of the 2026-06-12 uno-drop conversion. **Every
component is already dark-ready**: the whole tree was converted to theme vars only (the
gray scale maps to `var(--color)` / `var(--color-secondary)` / `color-mix` recipes — no
hardcoded grays remain in components). The `.dark` / `.light` class selectors in
`theme.css` are already ACTIVE (svelte-look uses them); only the system auto-switch is
commented out and there is no user toggle yet. The leftovers are all in the GLOBAL css
layer (captured-verbatim uno output) — see audit hotspots.

> Verify with the whole-app screenshot sweep `site/e2e/uno-parity-shots.mjs` (light vs dark
> baselines) — the false-diff gotchas (dev-server AA drift, the `pnpm check` reload storm,
> blocked avatars, Mapbox/embed flake) live in `.knowledge/testing/browser-deep-flow.md`.

Sibling issue with the same playbook: house `.issues/dark-mode-flip.md`.

## How it works (the tutor pattern — port it, it's proven)

Three cooperating pieces, copied from `~/code/tutor/site`:

1. **CSS** (`src/lib/theme.css`): `:root, .light { … }` and `.dark { … }` are already in
   place. Uncomment the `@media (prefers-color-scheme: dark) { :root:not(.light) { … } }`
   block (~line 100). UNLIKE house, LD's commented block already includes the
   `color-scheme: dark; background-color; color;` paint lines — uncomment as-is, no
   additions needed. Update the "DARK MODE — light-forced" header comment.
2. **State module** — port tutor's `src/lib/dark-mode.ts` verbatim (27 lines, already
   snake_case): `ColorScheme = 'system' | 'light' | 'dark'` persisted in
   `localStorage['color_scheme']` (absence = system); `apply_color_scheme` puts `.dark` or
   `.light` on **`document.body`**. Body-class vars override the html-level media-query
   vars for body + descendants (element proximity), so forced light/dark beats the OS
   preference; no class = media query rules.
3. **Init + toggle UI**:
   - Root `+layout.svelte`: `onMount(() => init_color_scheme())`. NOTE: tutor accepts a
     brief flash-of-wrong-theme for users who *forced* a scheme opposite their OS
     (system-followers are instant via the media query). If it bothers us, a tiny inline
     script in `app.html` `<head>` reading localStorage pre-paint fixes it — tutor hasn't
     needed it.
   - Toggle: tutor's 3-way **cycle button** (system → light → dark), see
     `tutor site/src/lib/layout/SideMenuContent.svelte:38-61` — local
     `$state<ColorScheme>('system')` hydrated in `onMount` (SSR-safe), icons
     `~icons/material-symbols/brightness-auto` / `light-mode` / `dark-mode`.
   - **Where in LD**: `lib/components/shell/UserMenu.svelte` (signed-in dropdown) is the
     natural home. Signed-out visitors just follow their OS preference — fine. Could add
     to `/account` later.

## Runbook

1. [ ] Port `src/lib/dark-mode.ts` from tutor + `init_color_scheme()` in root layout onMount.
2. [ ] Cycle button in `UserMenu.svelte`.
3. [ ] Uncomment the `prefers-color-scheme` block in `theme.css`; update its header comment.
4. [ ] Fix the global-layer literals (audit hotspots below).
5. [ ] `svelte-look.config.ts` → `dark_mode: true` (drop the "light-only app" comment);
   audit the ~13 stories in dark.
6. [ ] Browser audit on :3041 with devtools `prefers-color-scheme: dark` emulation — walk
   home globe / dictionaries / entries (list/table/gallery), entry detail + editor modals,
   about/contributors/settings/import/export, account, admin.
7. [ ] Dark screenshot sweep: reuse `site/e2e/uno-parity-shots.mjs` (23 routes) — add a
   dark flag that calls
   `page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])`.
8. [ ] `pnpm check` + `pnpm test` + `pnpm lint`.

## Audit hotspots (logged during the uno conversion)

- **`src/routes/global.css`**:
  - select arrow is an inline SVG data-URI with literal stroke `#6b7280` — invisible-ish
    on dark? Needs a `.dark` variant data-URI (CSS vars don't reach into data-URIs) AND a
    `@media (prefers-color-scheme: dark) { :root:not(.light) select { … } }` twin (system-dark
    users get no `.dark` class). Add both AT the flip, not before (an active media-query rule
    would show a light arrow alone while the rest is still light-forced).
  - ✅ scrollbar colors converted to dark-aware `color-mix` 2026-06-12 (house's recipe,
    sub-perceptual vs the legacy literals).
  - a text-shadow outline uses literal `hsl(0,0%,25%)` — check its surface in dark.
- **`src/lib/forms.css`** (`.form-input`, 16 call sites): literal gray border
  `rgb(209 213 219)` + blue focus ring literals (`rgb(147 197 253)` etc) — repoint at
  `var(--border-color)` / `--primary`-derived color-mix.
- **`src/lib/uno-preflights.css`** forms element preflights: raw `input`/`select`/
  checkbox get `background-color:#fff`, `border-color:#6b7280`, placeholder `#6b7280`,
  accent `#2563eb` — white inputs on dark background. Repoint at theme vars (keep the
  `--un-*` var-init block untouched — the vendored `sp-*` shadows depend on it).
- **`src/lib/typography.css`** (`tw-prose`, 5 usage sites): body/heading/etc colors are
  literal grays via `--un-prose-*` vars defined at the END of the file. The dump also
  carries the unused `--un-prose-invert-*` dark values — either repoint the used vars at
  theme vars or add a `.dark`-scoped remap to the invert values.
- **PRINT MUST STAY LIGHT**: entries print view (`EntriesPrint` / `PrintEntry`;
  `@media print` blocks in `entries/+page.svelte` + `[dictionaryId]/+layout.svelte`) —
  force light vars under `@media print` so a dark-mode user doesn't print a dark page.
- **Vendored `sp-*` svelte-pieces** (Button/Modal/Menu pre-compiled styles): check their
  grays/shadows on dark — they predate the theme-var conversion.
- **Mapbox** (home globe, static maps, GeoTagging): light map style inside dark UI is
  acceptable for v1 (`ToggleStyle` control exists); just eyeball the seams.
- **Media white-matte**: lh3 photo thumbnails, YouTube embeds, firebase logo — look for
  white-box artifacts on dark.
- **FA-kit `<i>` glyphs** inherit `currentColor` — should be fine; spot-check any with
  inline color styles.

## Reference paths

- tutor: `site/src/lib/dark-mode.ts`, `site/src/lib/layout/SideMenuContent.svelte`
  (toggle), `site/src/routes/+layout.svelte` (init), `site/src/lib/theme.css`
  (live media-query block).
- LD: `site/src/lib/theme.css` (commented block ~100), `site/src/routes/global.css`,
  `site/src/lib/{forms,uno-preflights,typography}.css`,
  `site/src/lib/components/shell/UserMenu.svelte` (toggle home),
  `site/svelte-look.config.ts` (`dark_mode`), `site/e2e/uno-parity-shots.mjs` (sweep).
