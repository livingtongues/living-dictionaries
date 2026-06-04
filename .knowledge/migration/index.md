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
- [unocss-svelte-scoped-to-universal.md](./unocss-svelte-scoped-to-universal.md) — M2a plugin
  swap: the svelte-scoped defaults the universal plugin drops (directives transformer +
  Svelte `class:` extraction) and how to restore them; `@unocss/reset` becoming a direct dep AND
  needing a CSS cascade layer (else modal overlays go transparent from an equal-specificity tie);
  why svelte-pieces' pre-compiled CSS is unaffected; grep-based CSS parity checks; and using a
  headless browser on `node build`/throwaway `vite dev` to debug dev-only CSS.
