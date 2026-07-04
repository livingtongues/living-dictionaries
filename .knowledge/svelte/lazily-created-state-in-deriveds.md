# Signals created during a reaction can't be its dependencies (`current_sources`)

**The single most important reactive-store gotcha in this codebase (and house/tutor,
which share the store patterns).** Root-caused 2026-07-04 by instrumenting svelte
5.56's runtime; full repro in repo-root `reactivity-poc/`.

## The rule (svelte semantics, by design)

Every signal created while a reaction (derived/effect) is executing is recorded in
that run's `current_sources` (`push_reaction_value`, `runtime.js`), and `get()`
refuses to register it as a dependency of that reaction. This is the guard that
makes mutating your own freshly-created state legal (no `state_unsafe_mutation`, no
self-invalidation loops). `SvelteMap#source` documents the same semantics.

Coverage is TOTAL, not just `$state` fields:
- class-field / variable `$state(...)`
- **all deep-proxy internals** — `proxy.js` does `import { state as source }`, so a
  reactive array's `version`, `length`, and per-index sources all count
- **deriveds created inside the reaction** (`deriveds.js` also calls
  `push_reaction_value`) — a nested `$derived` bridge does NOT escape the trap

## The failure mode

A store LAZILY constructed on first read (our `LiveDb`/`DictLiveDb` table/row/query
stores) gets constructed inside whichever `$derived`/effect reads it first. That
creator reaction finishes with **zero dependency edges** on the store → it is never
invalidated → **frozen forever, silently** — even untracked pulls (event handlers)
return the stale cached value, because the derived is never marked dirty. Later
readers track fine, so the bug looks intermittent (depends on evaluation order).

## The fix pattern

Construct reactive state OUTSIDE the consuming reaction:
`$lib/db/client/live/construct-outside-reaction.svelte.ts` — an immediately-destroyed
`$effect.root` (its body runs synchronously with `active_reaction = null`; root
effects are exempt from `derived.effects` teardown; SSR compiles `$effect.root` to a
noop, hence its sentinel fallback). Any NEW lazily-created reactive store must use it.

## Debugging technique that cracked it

`reactivity-poc/` + `optimizeDeps.exclude: ['svelte']` + `console.log` taps inside
`node_modules/svelte/.../runtime.js` (`get()`'s `current_sources` skip + the post-run
dep wiring), toggled by `globalThis.__DEP_DEBUG`. Gotchas: vite doesn't watch
node_modules (restart after edits, and beware multiple zombie vite processes serving
stale transforms), and **pnpm hard-links node_modules into its global store** —
restore pristine files from the npm tarball afterward or you poison future installs.

## Status across repos

- LD: fixed in both stores (+ `id()` accessors' nested-`$derived` variant removed).
- house: same store code, NOT yet ported (see `.issues/dict-table-accessor-rows-reactivity.md` follow-up).
