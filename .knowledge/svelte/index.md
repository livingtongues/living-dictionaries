# svelte/ — Svelte 5 runtime + client-layout gotchas

Deep framework-internals findings that affect how we write reactive code (not
lookup-able in the svelte docs).

- [layout-measure-feedback-loops.md](./layout-measure-feedback-loops.md) — never feed a
  `bind:clientHeight` reading back into the measured element's own layout; it loops at 60fps
  (the entries-list row quiver). The three couplings that cause it, the fixed-width
  `container-type: size` pattern that replaces it, and the across-frames measurement that proves
  a fix.

- [lazily-created-state-in-deriveds.md](./lazily-created-state-in-deriveds.md) —
  signals created during a reaction's run are excluded from its dependencies
  (`current_sources`); lazily-constructed stores silently freeze their first reader;
  fix = `construct_outside_reaction`. Includes the runtime-instrumentation debugging
  recipe.
- [state-proxy-breaks-identity-includes.md](./state-proxy-breaks-identity-includes.md) —
  `$state` deep-proxies assigned objects, so `array.includes(stateVar)` / `===`
  against a raw element is always false → a reconciling `$effect` loops forever
  (`effect_update_depth_exceeded`). Fix = `$state.raw` (or compare by primitive key).
  Was the "parts of speech menu freezes after first search" bug.
- [third-party-callbacks-during-teardown.md](./third-party-callbacks-during-teardown.md) —
  component teardown runs inside the parent BLOCK_EFFECT, so a library callback
  fired synchronously from `destroy()` (TipTap's blur transaction) mutating
  `$state` throws `state_unsafe_mutation`. Fix = defer + stop-at-teardown
  (`create_editor_tick`), plus how to trace a minified prod stack to the real
  component.
