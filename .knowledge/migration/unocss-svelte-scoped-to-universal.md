# UnoCSS: `@unocss/svelte-scoped` → universal `unocss/vite` (M2a)

Done in M2a (still on Svelte 4) so the toolchain change is isolated from the Svelte 5 bump.
What's here is the non-obvious stuff; the wiring itself is in `site/vite.config.ts`,
`site/uno.config.ts`, `site/src/routes/+layout.svelte`, `site/src/app.html`,
`site/src/hooks.server.ts`. Full play-by-play: `.issues/subagent-reports/m2a-unocss-plugin-swap.md`.

## The plugin doesn't change classes — but it drops two svelte-scoped defaults
Swapping the plugin alone (universal `UnoCSS()` + `import '@unocss/reset/tailwind.css'` +
`import 'virtual:uno.css'` in the root layout, drop the `%unocss-svelte-scoped.global%`
placeholder) compiles and boots, but **silently breaks styling** because `@unocss/svelte-scoped`
did two things by default that the universal plugin does **not**:

1. **Ran the directives transformer.** `--at-apply` / `@apply` inside component `<style>` blocks
   only work if you add `transformers: [transformerDirectives()]` (its defaults already cover
   `--at-apply`). Without it those rules vanish — e.g. the dictionary side menu, whose links style
   via `a:not(.link){ --at-apply: … }`, renders unstyled. ~14 files use `--at-apply`.
2. **Understood Svelte `class:utility={cond}` directives.** The universal plugin's default text
   extractor doesn't parse `class:foo`, so a utility applied *only* that way never gets generated
   (e.g. the entry title's `class:text-4xl`, and the entry-overlay modal content's
   `class:order-2`/`class:pt-1`/`class:!-top-6`). Fix = a tiny custom extractor matching
   `\bclass:(…)`. **Core auto-adds the built-in default extractor back** (`resolveConfig` unshifts
   `extractorDefault` if your config omits it), so plain `class="…"` extraction is NOT lost by
   supplying your own `extractors` array — verified, but worth re-checking if you ever change it.

## `@unocss/reset` must be a *direct* dep now
svelte-scoped's `injectReset` resolved `@unocss/reset/tailwind.css` from its own node_modules. A
direct app import needs it **declared** (pnpm isolated node_modules) — it was only transitive (via
`unocss`), so the build fails with `Rollup failed to resolve "@unocss/reset/tailwind.css"` until you
add `@unocss/reset` to `site` devDeps. Its lockfile entries already exist (kept alive by `unocss`),
so it's one importer line, no download/version change.

## The reset must live in a CSS cascade layer (modal overlays went transparent)
svelte-scoped injected its reset first in `<head>`; the universal plugin's `import
'@unocss/reset/tailwind.css'` lands wherever the bundler/HMR puts it. That exposed an **unstable
equal-specificity tie**: the reset's `button,[type=button],…{ background-color:transparent }` —
`[type=button]` is **(0,1,0)** — ties svelte-pieces' modal backdrop
`<button type=button class="sp-8i1hz2">` → `.sp-8i1hz2{ background:#000;opacity:.5 }`, also
**(0,1,0)**. Equal specificity ⇒ source order wins, and dev CSS-injection order is
non-deterministic (HMR), so `getComputedStyle` flips between `rgb(0,0,0)` and `rgb(0,0,0,0)` across
navigations — every modal overlay rendered transparent on a long-running dev server (prod build
happened to order it correctly, so prod was fine — making this a dev-only, easy-to-miss bug).

**Fix:** load the reset in a low-priority cascade layer so unlayered author/utility styles *always*
beat it regardless of order. `site/src/routes/reset.css`:
`@import '@unocss/reset/tailwind.css' layer(reset);` (imported by `+layout.svelte`). Safe because
UnoCSS's `virtual:uno.css` emits **no** CSS `@layer` (utilities stay unlayered → they beat the
layer), and a reset is *meant* to be the lowest-priority floor. Verified the reset still applies
where uncontested (`box-sizing`, `button{cursor:pointer}`) and utilities still win
(`font-semibold`→600). This is the robust equivalent of svelte-scoped's `<head>`-first injection and
fixes **every** reset-vs-author tie app-wide, not just the modal.

## Diagnosing dev-only CSS with a headless browser
`curl` can't see computed styles and the dev server `:3041` isn't sandbox-reachable — but the prod
`node build` server **and a throwaway `vite dev --port <not 3041>`** both are. Drive Chrome via the
`browser-tools` skill: navigate, click to open the modal, then `getComputedStyle(el)` /
`getBoundingClientRect()` on `.sp-8i1hz2`. That's how the transparent-vs-black flip (and that the
backdrop *size* was just the small headless window) were nailed down. Repeat across several
navigations to catch order-dependent flakiness.

## svelte-pieces ships pre-compiled CSS — not affected by the plugin
`svelte-pieces` (a dep) ships components whose utility styles are **already compiled** to
`:global(.sp-xxxxxx){…}` (done with svelte-scoped at *its* build time). They're plain CSS the
Svelte compiler includes when the component is imported — independent of which UnoCSS plugin the app
uses. So e.g. the `Modal` backdrop (`:global(.sp-8i1hz2){ background:rgb(0 0 0/…); opacity:.5 }`)
was byte-identical in the build before and after the swap. When a svelte-pieces component "looks
wrong" after the swap, suspect the **app-side** content it wraps (broken `class:`/`--at-apply`), not
the library's own styles.

## How to verify CSS parity without a browser
The agent can't see :3041. Build, then grep the emitted CSS in `build/client/_app/immutable/`:
utility-only-via-`class:` tokens like `.text-4xl` should be present (were 0 before the extractor
fix); `--at-apply` should appear **0** times in output (means the transformer ran); scoped rules
like `a.svelte-xxxx:not(.link){…}` should contain expanded properties (flex/padding/color), not a
bare `--at-apply`. Jacob still eyeballs live for true paint/parity.
