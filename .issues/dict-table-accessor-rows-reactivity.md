# DictLiveDb table-accessor `.rows` doesn't propagate into a bare `$derived`

Found 2026-07-04 while building the featured-entry star (dictionary-home work).
**RESOLVED 2026-07-04 — root-caused, fixed in both stores, verified e2e.**

## Symptom

On the entry detail page:

```ts
const star_row = $derived(dict_db?.featured_entries.rows.find(row => row.entry_id === entry.id))
```

The store started and held the row, but the `$derived` never re-evaluated — stale
even for untracked pulls from the click handler (→ duplicate INSERT). Silent.

## Root cause (svelte 5.56, confirmed by instrumenting the runtime)

1. Every signal created **while a reaction is running** is recorded in that run's
   `current_sources` (`push_reaction_value` in `runtime.js`). This covers class-field
   `$state(...)` **and all deep-proxy internals** — `proxy.js` does
   `import { state as source }`, so the reactive array's `version`/`length`/index
   sources go through the pushing path too.
2. `get()` refuses to register a dependency on any signal in `current_sources` — the
   guard that makes mutating your own freshly-created state legal (`SvelteMap#source`
   documents the same "own state is not a dependency" semantics).
3. The table store was lazily CONSTRUCTED inside the consuming `$derived`'s first
   evaluation (`#get_table_store` called from the `.rows` getter), so **every** signal
   the derived read belonged to its own `current_sources` → the derived finished with
   ZERO dependency edges → never invalidated → frozen forever. Untracked pulls return
   the cached value because the derived is never marked dirty.
4. Readers that arrive AFTER the store exists track normally — which made the bug look
   intermittent (it depends on which reaction evaluates first) and is why the
   two-derived `.query()` workaround worked: `.query()` created the store in derived
   #1 while `.rows` was read in derived #2.

Reproduction + mechanism walkthrough: repo-root **`reactivity-poc/`** (`/broken`,
`/broken-find` = exact entry-page replica, `/fixed`), instrumented against the actual
svelte runtime (`[dep-skip]` fired on `#rows` AND `#rows.length` in the creator run).

## Fix (shipped)

`$lib/db/client/live/construct-outside-reaction.svelte.ts` — runs the constructor
inside an immediately-destroyed `$effect.root` (body executes synchronously with
`active_reaction = null`; root effects are exempt from `derived.effects` teardown;
sentinel fallback for SSR where `$effect.root` compiles to a noop).

Applied to all three store-creation sites in BOTH stores (`dict-live-db.svelte.ts`
`#get_table_store`/`#get_row_store`/`#create_query_accessor`, `live-db.svelte.ts`
equivalents). Also simplified both `id()` accessors: their nested `$derived` was
itself "own state" of the calling reaction (`push_reaction_value` covers deriveds
too, `deriveds.js`) — same freeze — replaced with a direct `.rows[0]` read.

The entry page is back on the bare pattern (regression-exercises the fix); the
database skill's KNOWN BUG note is replaced with the fixed guidance.

## Verification

- `reactivity-poc/` e2e: `/broken` + `/broken-find` reproduce on stock svelte, `/fixed` live.
- Real app headless e2e (dev 3041, achi entry, bare pattern restored): star toggled
  4×, `.starred` class tracked every change, no console errors.
- site: 1245 vitest passed, `pnpm check` 0 errors, lint clean.

## Follow-up

- [ ] **house has the same store code** (`LiveDb`, not covered by the worker-harness
      PARITY manifest) — port `construct-outside-reaction` + the `id()` simplification
      to house's `$lib/db/client/live/`.
- Knowledge entry: `.knowledge/svelte/lazily-created-state-in-deriveds.md`.
