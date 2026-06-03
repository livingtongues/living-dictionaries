# Migration knowledge

Gotchas/decisions for evolving LD off Vercel+Supabase onto VPS+SQLite. Plan + status:
`.issues/vps-migration.md`.

## Pages
- [build-and-deploy-gotchas.md](./build-and-deploy-gotchas.md) — pnpm lockfile discipline,
  the adapter-node swap fallout (deps/devDeps bucketing, rollup bump, `@types/node` dedup),
  and the local-build/boot loop.
- [unocss-svelte-scoped-to-universal.md](./unocss-svelte-scoped-to-universal.md) — M2a plugin
  swap: the svelte-scoped defaults the universal plugin drops (directives transformer +
  Svelte `class:` extraction) and how to restore them; `@unocss/reset` becoming a direct dep AND
  needing a CSS cascade layer (else modal overlays go transparent from an equal-specificity tie);
  why svelte-pieces' pre-compiled CSS is unaffected; grep-based CSS parity checks; and using a
  headless browser on `node build`/throwaway `vite dev` to debug dev-only CSS.
