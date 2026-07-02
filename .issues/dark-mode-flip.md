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

## Runbook (2026-07-02 session — Jacob approved scope)

Scope decisions from Jacob:
- Full flip runbook, AND full skill restyle of forms/typography while in there (not just
  theme-var repointing) — "make them look good and be very usable".
- Toggle in UserMenu (signed-in) AND a signed-out-reachable spot → Footer.
- Verify: svelte-look dark audit of all stories + uno-parity-shots.mjs dark sweep; fix
  everything ugly found.

1. ✅ Port `src/lib/dark-mode.ts` from tutor + `init_color_scheme()` in root layout onMount.
2. ✅ Cycle button: shared `ColorSchemeToggle.svelte` (mdi icons + `icon-inline` shim — bare
   svg is display:block per the reset!) in `UserMenu.svelte` + compact in `Footer.svelte`.
   i18n keys `misc.appearance/theme_system/theme_light/theme_dark`. Verified with puppeteer:
   cycles system→light→dark, body class + localStorage persist across reload.
3. ✅ theme.css: media block uncommented; `@media print` force-light block added (kept LAST —
   source order beats the tied selectors); body text = mode-aware gray-800 port (see 6a).
4. ✅ forms.css rewritten (skill-styled, element-level, theme vars; NATIVE checkbox/radio via
   accent-color; select arrow data-URI mode-neutral #888). `.form-input` rules deleted +
   class stripped from all call sites (scoped `.form-input` overrides repointed at elements).
   uno-preflights.css now ONLY the `--un-*` var-init block.
5. ✅ typography.css rewritten readable on theme vars (another session added `.smallcaps` —
   kept). Verified via MarkdownEditor + about stories.
6. ✅ Global/component literals:
   - a. **`<body class="text-gray-800">` in app.html was the big one** — a literal gray-800
     body color killed dark text site-wide. Removed; theme.css `body, body.light, body.dark`
     now carries `color-mix(in srgb, var(--color) 88%, var(--background))` (the body.X legs
     beat the `.light`/`.dark` block color).
   - b. global.css: select rule merged into forms.css; global `hr { border-color:
     var(--border-color) }` (reset leaves hr currentColor → glaring white in dark).
   - c. Header logo: `--invert-in-light` theme var (invert(100%) light / none dark) — added
     to all four theme blocks; `#000` hovers → var(--color) (Header, dict layout, Keyman).
   - d. Footer hover `#1d4ed8` → var(--primary); vendored Menu.svelte → background/surface
     vars + border; MultiSelect surfaces/hovers → vars (blue chips kept, self-contained);
     IpaKeyboard contained as light widget (`.ipa-charts` forces light text + white tables).
   - e. Partner logos: `.logo-matte` white backing (logos designed for white; invisible in light).
7. ✅ Vendored sp-*: Modal/Slideover/ResponsiveSlideover/ResponsiveTable/data-JSON neutral
   surfaces+texts+borders → theme vars (perl bulk over the minified styles). Button.svelte:
   primary/red/orange/green mapped onto --primary/--danger/--warning/--success (outline text
   was literal blue-700 etc — dim on dark), filled hovers via color-mix, black/white/menu/
   text/link/active neutrals onto color-mix recipes. Toasts + Badge already fine.
8. ✅ `svelte-look.config.ts` → `dark_mode: true`; audited UserMenu, EditSource, ApiKeys,
   MarkdownEditor, SideMenu stories in dark (48 story files exist now, not ~13).
9. ✅ Dark sweep: DARK=1 flag added to uno-parity-shots.mjs; full light + dark sweeps
   clean (all 23 routes, /tmp/dark-flip/final-{light,dark}). The blocking xss CJS
   named-import in the cutover session's `sanitize-rich-text.ts` was default-imported
   (dev SSR 500s on entries/about/grammar) — coordinated with session 0a470dbe.
   Fixes that came out of the sweep:
   - Entry detail dashed field dividers were the tailwind reset's literal `#e5e7eb`
     default border → theme.css sets `--un-default-border-color` to a mode-aware mix
     (reset supports the var; ≈ gray-200 in light, subtle in dark).
   - ModalEditableArray chips (PoS etc): blue-100 literal + inherited text → primary-tint
     mix + var(--color) (matches BadgeArray; white-on-blue-100 was unreadable in dark).
   - EntriesTable: `#ccc` cell borders, green-100 recently-updated, gray row-hover → mixes.
   - Toggle verified with puppeteer (cycle + persistence + forced-dark screenshot);
     Contact modal, table/gallery/print views probed with click-scripts — all good.
   Local data note: `.data` had only test dicts — re-seeded achi via
   `scripts: npx tsx supabase-cutover/migrate.ts -e prod --dict-id achi --data-dir <site/.data>`
   (its DEFAULT_DATA_DIR resolves to ~/code/site/.data — wrong, always pass --data-dir);
   sweep entry id updated e_abaj → 06Tmb3jM1atoGNQvlxIY.
10. ✅ `pnpm test` (1048 passed) + `pnpm lint` (after adding `**/.data/**` to eslint ignores)
    + `pnpm check` (the 2 errors were the xss typing in the other session's file, since
    fixed there). Jacob will run final checks himself.

## Docs updated
- AGENTS.md styling bullet (dark live, forms.css element styles, .form-input gone).
- svelte-ui SKILL.md (dark_mode true; HeadlessButton exists — the "no HeadlessButton"
  claim was already stale).
- otter WEB.md shared-conventions styling paragraph (LD dark live; house still pending).

## Follow-ups (logged, not blocking)
- `.issues/ui-skill-alignment.md` phase 4 is largely DONE by this flip (forms.css +
  typography.css rewritten, uno-preflights trimmed to the --un-* block); phases 1-3/5
  (FA kit swap, mdi unification, .btn-* adoption, minimal-chrome restyle) remain.
- Admin ntfy onboarding inner card stays white-ish in dark (readable, just bright) — polish.
- Gallery view unverified with photos (seeded achi has no photo rows in dev).
- Mapbox stays light-styled inside dark UI (accepted for v1; ToggleStyle exists).

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
