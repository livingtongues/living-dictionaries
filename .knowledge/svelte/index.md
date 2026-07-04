# svelte/ — Svelte 5 runtime behavior gotchas

Deep framework-internals findings that affect how we write reactive code (not
lookup-able in the svelte docs).

- [lazily-created-state-in-deriveds.md](./lazily-created-state-in-deriveds.md) —
  signals created during a reaction's run are excluded from its dependencies
  (`current_sources`); lazily-constructed stores silently freeze their first reader;
  fix = `construct_outside_reaction`. Includes the runtime-instrumentation debugging
  recipe.
