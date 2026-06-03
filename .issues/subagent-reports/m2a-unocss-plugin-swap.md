# M2a · UnoCSS plugin swap — `@unocss/svelte-scoped` → universal `unocss/vite`

**Status:** ✅ done & verified. Still on **Svelte 4** (toolchain change isolated from the Svelte 5
bump). Working tree only — **not committed**. Did NOT touch any component's classes/syntax, and
did NOT start M2b.

## Why
`@unocss/svelte-scoped` fights the Svelte 5 toolchain. The universal `unocss/vite` plugin works on
Svelte 4 too, so swapping it first means any visual drift is attributable to the plugin alone (not
the later Svelte 5 jump). Same `uno.config.ts` presets, same `i-*` icons, same utility classes.

## How the universal plugin is wired
The svelte-scoped model injected a global `<style>` blob into `app.html` at SSR time via a
placeholder + `transformPageChunk`, and got its reset through the plugin's `injectReset` option.
The universal plugin instead exposes a **virtual stylesheet** you import once; the reset is a
normal CSS import. So:

- The plugin (`UnoCSS()`) generates `virtual:uno.css` from `uno.config.ts`.
- The root layout imports, in order: **reset → uno utilities → app globals**, so app CSS wins.

## Files changed
| File | Change |
|---|---|
| `site/vite.config.ts` | `import UnoCSS from '@unocss/svelte-scoped/vite'` → `from 'unocss/vite'`; `UnoCSS({ injectReset: … })` → `UnoCSS()` (universal plugin has no `injectReset`). |
| `site/src/routes/+layout.svelte` | Added at top of `<script>`: `import '@unocss/reset/tailwind.css'` then `import 'virtual:uno.css'`, above the existing `import './global.css'`. |
| `site/src/app.html` | Removed the `%unocss-svelte-scoped.global%` placeholder line (kept `%sveltekit.head%`). |
| `site/src/hooks.server.ts` | Removed the `transformPageChunk` that replaced `%unocss-svelte-scoped.global%`; `resolve(event)` now called plainly. |
| `site/package.json` | Removed devDep `@unocss/svelte-scoped`; added devDep `@unocss/reset@^0.58.5` (see deps note). |
| `pnpm-lock.yaml` | Hand-edited (see below). |

`uno.config.ts` was **not** touched — `presetUno`, `presetForms`, `presetTypography`, and
`presetIcons({ prefix: 'i-' })` all carry over unchanged.

## Dependency / lockfile notes (lockfile-fidelity rule honored)
- **`@unocss/reset` had to become a direct dep.** svelte-scoped's `injectReset` resolved
  `@unocss/reset/tailwind.css` from svelte-scoped's *own* node_modules. Now the app imports it
  directly, and under pnpm's isolated `node_modules` a package must be a **declared** dependency to
  be importable — `@unocss/reset` was only transitive (via `unocss`/`@unocss/astro`). So the build
  failed (`Rollup failed to resolve "@unocss/reset/tailwind.css"`) until it was added as a direct
  devDep. Its package/snapshot entries already existed in the lockfile (kept alive by `unocss`), so
  this added **one importer reference**, no download, no version change.
- **`@unocss/svelte-scoped` removed cleanly.** Its lockfile deps (`@unocss/config`, `@unocss/reset`,
  `css-tree`, `magic-string`) are all also depended on by `@unocss/vite`/`unocss`, so it had **zero
  exclusive transitive deps** — removing its 3 blocks orphaned nothing.
- **Method:** edited the lockfile by hand (never ran a non-frozen `pnpm install` — `--lockfile-only`
  was tried once and re-resolved the whole graph / drifted `typescript` + `@types/node`, so it was
  reverted). Net `diff` of `pnpm-lock.yaml` vs the pre-change baseline = exactly: svelte-scoped
  importer line replaced by the `@unocss/reset` importer line, and the two svelte-scoped
  package/snapshot blocks deleted. `pnpm install --frozen-lockfile` → "Lockfile is up to date."

## Verification
- `pnpm --filter=site check` → **0 errors, 62 warnings** (baseline). `virtual:uno.css` types fine
  via Vite's ambient `*.css` module decl — no extra `.d.ts` needed.
- `pnpm --filter=site test --run` → **123 passed** (30 files).
- `eslint --quiet` on changed files → clean (exit 0).
- `pnpm --filter=site build` → ✔ (the AWS-SDK/d3-voronoi "Circular dependency" warnings are
  pre-existing, unrelated).
- `PORT=3081 node build` boot → `/`, `/dictionaries`, `/about`, `/achi` all **200**; server log =
  just `Listening on …` (no SSR 500s).
- **CSS actually served:** fetched the layout CSS chunk (`/_app/immutable/assets/0.*.css`, ~86 KB)
  — contains the tailwind reset (`box-sizing:border-box`, `-webkit-text-size-adjust`,
  `::placeholder`, `font-feature-settings`), compiled utilities (`.flex`, `.rounded-md`,
  `.text-gray-800`), and `i-*` icon classes (`.i-bi-camera-video`, `.i-carbon-caret-down`, …).

## Jacob must eyeball
Agent has no WebGL and the dev server (`:3041`) isn't sandbox-reachable, so **visual parity is the
one thing not machine-verified.** Please eyeball `:3041` in **light mode** — chrome, the globe page,
a dictionary, `/about` — and confirm it looks identical to before. One thing to watch: with
svelte-scoped the global blob was inlined into `<head>` at SSR; now it's a normal `<link>`
stylesheet, so there's a theoretical chance of a one-frame unstyled flash on a cold load (didn't
observe anything off in the served HTML, but only a human eye confirms paint).

## Post-review fixes (Jacob spotted visual drift on :3041)
Two behaviors `@unocss/svelte-scoped` did **by default** that the universal plugin does **not** —
both fixed in `uno.config.ts`, no component edits:

1. **`@apply` / `--at-apply` directives in `<style>` blocks weren't processed.** svelte-scoped ran
   the directives transformer implicitly; the universal plugin needs it added. Symptom: the
   dictionary **side menu was unstyled** (its links style via `a:not(.link){ --at-apply: … }`), and
   any other `<style>`-block `--at-apply` (14 files: SideMenu, EditField, Filter, several admin/
   sort components, etc.) silently did nothing. **Fix:** `transformers: [transformerDirectives()]`
   (its defaults already include `--at-apply`).
2. **Svelte `class:utility={cond}` directives weren't extracted.** The universal plugin's default
   text extractor doesn't understand `class:foo` syntax (svelte-scoped's Svelte-aware extractor
   did). Symptom: utilities applied *only* via `class:` never generated — e.g. the **entry title
   was small** (`class:text-4xl={field==='lexeme'}` in `EntryField.svelte`), and the entry-overlay
   **modal content collapsed/mis-laid out** (entry view uses `class:order-2`, `class:pt-1`,
   `class:!-top-6`, `class:hover:bg-gray-100`, …). **Fix:** a small custom `extractors` entry that
   pulls the utility name out of every `\bclass:(…)` match. Core auto-re-adds the built-in default
   extractor (`resolveConfig` unshifts `extractorDefault` if absent), so plain `class="…"`
   extraction is unaffected — verified.

3. **The modal grey overlay was an unstable equal-specificity cascade tie (the real backdrop bug).**
   Diagnosed with a headless browser against `node build` + a throwaway `vite dev` (the prod server
   and a non-3041 dev port are both sandbox-reachable). The svelte-pieces `Modal` backdrop is a
   `<button type="button" class="sp-8i1hz2">` styled `:global(.sp-8i1hz2){ background:#000; opacity:.5 }`
   — **specificity (0,1,0)**. The tailwind reset has `button,[type=button],…{ background-color:transparent }`
   — `[type=button]` is **also (0,1,0)**. Equal specificity ⇒ **source order decides**, and CSS
   injection order is non-deterministic in dev (HMR) — `getComputedStyle` flipped between
   `rgb(0,0,0)` and `rgb(0,0,0,0)` across navigations, so the overlay rendered transparent on Jacob's
   long-running :3041. svelte-scoped masked this by injecting its reset first in `<head>`. **Fix:** put
   the reset in a low-priority **CSS cascade layer** — new `src/routes/reset.css`:
   `@import '@unocss/reset/tailwind.css' layer(reset);` (imported by `+layout.svelte` instead of the
   bare reset). Unlayered styles (UnoCSS utilities — confirmed UnoCSS emits **no** `@layer` — and all
   component/library CSS) **always** beat a layered rule regardless of load order, so this robustly
   fixes the backdrop **and every other reset-vs-author tie app-wide**, in dev and prod. Verified via
   browser: backdrop now stable `rgb(0,0,0)`/opacity .5 full-viewport across repeated loads, dev +
   prod; reset still applies where uncontested (`box-sizing:border-box`, `button{cursor:pointer}`),
   utilities still win (`font-semibold`→600). Screenshot confirmed the dimmed overlay.

**Exhaustive sweep for the same bug-classes (Jacob asked to find any others):**
- `--at-apply`/`@apply` in `<style>` → fixed globally by the transformer (≈14 files), nothing left.
- Svelte `class:` directives → **all 30 distinct** directive utilities confirmed present in built CSS
  (the handful absent are non-utility state classes like `active`/`sompeng` styled in `<style>`).
- Variant-group syntax `hover:(…)` → **none used** (would've needed `transformerVariantGroup`).
- `@apply` in plain `.css` files → **none**.
- Reset-vs-author specificity ties → fixed app-wide by `@layer reset` (above).

**Re-verified after all fixes:** `check` 0 errors/62 warn · `test` 123 pass · eslint clean · `build` ✔
· boot → `/`, `/dictionaries`, `/about`, `/achi`, `/achi/entries`, `/achi/entry/<id>` all **200**,
log clean. Built CSS contains: `.text-4xl`, expanded `a…:not(.link)` menu rule (flex/padding/color),
`.active` colors, `min-height:50vh`, `.pt-1`, `.!-top-6`, `.order-2`; reset now inside
`@layer reset{…}`; plain classes (`.text-gray-500`) still present; **zero** raw `--at-apply` in output.

**Files added/changed in this round:** `site/uno.config.ts` (transformers + extractor),
`site/src/routes/reset.css` (new), `site/src/routes/+layout.svelte` (import `./reset.css`).

## Recommended next step — M2b
Bump to Svelte 5 in compatibility mode: `svelte`, `@sveltejs/vite-plugin-svelte` (v3→v5),
`svelte-check` (→ v4, drops the separate type pkg), and align peers. Old Svelte 4 syntax keeps
working in legacy mode; fix only what the dep bump breaks until build + boot + check are green
again. Keep the lockfile-fidelity discipline (hand-edit / frozen-install loop). Do M2b as its own
reviewable step before M2c (runes migration).
