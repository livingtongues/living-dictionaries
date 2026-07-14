# svelte/ — Svelte 5 runtime behavior gotchas

Deep framework-internals findings that affect how we write reactive code (not
lookup-able in the svelte docs).

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
