const UNSET = Symbol('unset')

/**
 * Run `fn` OUTSIDE the currently-evaluating reaction so any `$state` (or deep
 * proxy) it creates is usable as a dependency BY that reaction.
 *
 * Why: every signal created while a reaction is running — class `$state` fields
 * AND all deep-proxy internals (`proxy.js` does `import { state as source }`) —
 * is recorded in that run's `current_sources`, and svelte's `get()` refuses to
 * register a dependency on such "own state" (the guard that makes mutating your
 * own freshly-created state legal; `SvelteMap#source` documents the same
 * semantics). A `$derived` that lazily CONSTRUCTS a live-table store it reads
 * therefore finishes its first run with zero dependency edges and freezes
 * forever — see `.issues/dict-table-accessor-rows-reactivity.md` and the
 * repo-root `reactivity-poc/` reproduction.
 *
 * `$effect.root` runs its body synchronously with `active_reaction = null`, and
 * root effects are exempt from `derived.effects` teardown; we destroy the root
 * immediately (construction registers no effects to keep). On the server
 * `$effect.root` compiles to a noop that never runs `fn`, hence the sentinel
 * fallback.
 */
export function construct_outside_reaction<T>(fn: () => T): T {
  let result: T | typeof UNSET = UNSET
  const destroy_root = $effect.root(() => {
    result = fn()
  })
  destroy_root()
  if (result === UNSET)
    result = fn()
  return result
}
