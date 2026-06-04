# Migration knowledge

Gotchas/decisions for evolving LD off Vercel+Supabase onto VPS+SQLite. Plan + status:
`.issues/vps-migration.md`.

## Pages
- [build-and-deploy-gotchas.md](./build-and-deploy-gotchas.md) — pnpm lockfile discipline,
  the adapter-node swap fallout (deps/devDeps bucketing, rollup bump, `@types/node` dedup),
  and the local-build/boot loop.
- [svelte-5-runes-migration.md](./svelte-5-runes-migration.md) — M2c: running the runes codemod
  headlessly (the interactive CLI hangs; per-file Node driver + 30s timeout), the hand-fixes it
  can't do (`@migration-task`, `ComponentProps<typeof X>`, `$page.`→`page.` markup gap, email
  `svelte/server` render port, legacy-slot↔runes-snippet interop / Slideover conversion), why
  `bind:value={item.member}` is NOT `each_item_invalid_assignment`, driving warnings down via
  `compilerOptions.warningFilter`, runtime regression verification, and why eslint isn't a gate yet.
- [eslint-custom-config-and-runes-finish.md](./eslint-custom-config-and-runes-finish.md) — LD-A2:
  replacing antfu with the example's hand-written flat config (eslint 10 / svelte-plugin 3); why
  `lint:fix` churns ~125 files harmlessly; finishing the runes migration of the legacy stragglers to
  reach 0 lint errors (svelte-pieces slot/event conversion, the `state`/`$state` clash, `untrack`-ing a
  self-referential `$effect`, typing a JS action's custom event, `ban-types` removal, `{#each}` key
  conventions); the re-enabled pre-commit hook.
- [m4-sqlite-read-layer.md](./m4-sqlite-read-layer.md) — M4 read: replacing the M1 Supabase stub's
  READ path with server better-sqlite3 (`shared.db` catalog + per-dict `dictionaries/{id}.db` entries
  via a bundle endpoint feeding the Orama worker). Why LD's seam differs from house's reader port
  (client stub + search worker), the catalog/entries projections to legacy shapes, the confirmed
  adapter-node `dependencies` gotcha, the "only 4 of 2136 dbs have entries" data finding (+ `VACUUM
  INTO` seeding), keeping achi-flow unchanged by seeding fixtures into `achi.db`, the e2e harnesses
  + their external-error filtering, and what intentionally stays on the stub until auth/M4-write.
- [unocss-svelte-scoped-to-universal.md](./unocss-svelte-scoped-to-universal.md) — M2a plugin
  swap: the svelte-scoped defaults the universal plugin drops (directives transformer +
  Svelte `class:` extraction) and how to restore them; `@unocss/reset` becoming a direct dep AND
  needing a CSS cascade layer (else modal overlays go transparent from an equal-specificity tie);
  why svelte-pieces' pre-compiled CSS is unaffected; grep-based CSS parity checks; and using a
  headless browser on `node build`/throwaway `vite dev` to debug dev-only CSS.
