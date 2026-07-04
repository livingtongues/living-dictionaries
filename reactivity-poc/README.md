# reactivity-poc — lazily-created store × `$derived` dependency loss

Minimal SvelteKit reproduction of `.issues/dict-table-accessor-rows-reactivity.md`:
a live-table store (miniature of `site`'s `DictTableStore`) whose `$state` is lazily
created on first read **silently freezes the `$derived` that triggered the creation**.

```bash
pnpm install --ignore-workspace   # NOT a workspace member (like scripts/)
pnpm dev                          # → http://localhost:3099
```

| route | store construction | expected |
|---|---|---|
| `/broken` | inside the first consuming reaction (the old site pattern) | the creator derived freezes (stuck `loading: true`) while later readers stay live |
| `/broken-find` | same, but the creator is a lone `rows.find(...)` derived | exact replica of the LD entry-page star bug — derived dead even for untracked pulls |
| `/fixed` | hoisted out via `$effect.root` (`construct_outside_reaction`) | everything live, `✓ in sync` |

## Root cause (svelte 5.56, verified by runtime instrumentation)

1. Every signal created **while a reaction is running** is recorded in that run's
   `current_sources` (`push_reaction_value`, `runtime.js`). This covers class-field
   `$state(...)` **and all deep-proxy internals** — `proxy.js` does
   `import { state as source }`, so the array's `version`/`length`/index sources
   all go through the pushing path too.
2. `get()` **refuses to register a dependency** on any signal in `current_sources`
   (`runtime.js`, the guard that makes mutating your own freshly-created state legal
   and loop-free — same semantics `SvelteMap#source` documents).
3. So a `$derived` that lazily CONSTRUCTS the store it reads finishes its first run
   with **zero dependency edges** on the store → it is never invalidated → frozen
   forever. Even untracked pulls (event handlers) return the stale cached value
   because the derived is never marked dirty.
4. Any reader that comes along AFTER the store exists tracks normally — which is why
   the bug looks intermittent: it depends on which reaction happens to evaluate first.

## The fix

Construct the store **outside the consuming reaction** so its signals never land in
the consumer's `current_sources`:

```ts
export function construct_outside_reaction<T>(fn: () => T): T {
  let result: T | typeof UNSET = UNSET
  const destroy_root = $effect.root(() => { result = fn() })  // active_reaction === null inside
  destroy_root()
  if (result === UNSET) result = fn()  // SSR: $effect.root is compiled to a noop
  return result
}
```

`$effect.root` runs its body synchronously with `active_reaction = null`, and root
effects are exempt from `derived.effects` teardown. Applied in `site` to
`dict-live-db.svelte.ts` + `live-db.svelte.ts` store creation.

## Instrumentation notes

`vite.config.ts` sets `optimizeDeps.exclude: ['svelte']` so svelte is served from
source — you can add `console.log` taps to
`node_modules/svelte/src/internal/client/runtime.js` (`get()`'s `current_sources`
skip branch and the post-run dep wiring) and watch them with
`globalThis.__DEP_DEBUG = true`. Two gotchas: restart vite after editing
node_modules (not watched), and **pnpm hard-links node_modules files to its global
store** — restore pristine files from the npm tarball when done, or you poison
future installs.

`/tmp/poc-e2e.mjs` (if still around) drives all routes headless via the
browser-tools skill.
