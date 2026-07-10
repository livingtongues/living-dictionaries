# Test-suite performance: the commit-gate speedup (2026-07-10)

Ported from house (`~/code/house/.knowledge/tooling/test-suite-performance.md`). The mechanics live
in code — `open_test_shared_db()` in `src/lib/db/server/shared-db.ts`, the template inside
`open_dictionary_db_in_memory` in `dictionary-db.ts`, and `.githooks/pre-commit`. This page holds
only the LD-specific numbers + gotchas you can't read off the code.

## Two levers
1. **Serialized-template DB opens.** Re-running migrations per `beforeEach` was the cost. Migrate
   once per process → `db.serialize()` → `new Database(buf)` per test. Per-connection pragmas
   (`foreign_keys`, `busy_timeout`) must be re-applied after restore — `foreign_keys` is
   per-connection in SQLite and does NOT survive deserialize.
2. **`vitest run --changed` at the gate**, full-suite fallback for non-graph-traceable changes.

## LD-specific numbers (mustang, 2 vCPU, 2026-07-10)
- Per-open microbench: **shared.db 42.4ms → 0.18ms** (235×, 11 migrations); **dict.db 58.3ms → ~0.2ms**
  (4 migrations — heavier per-migration than shared). Bigger deserialize win than house (2.3ms) because
  LD's schema is smaller.
- Full `vitest run`: in-test bucket **51.7s → 31.3s**; wall **~229s → ~214s**. Wall barely moves: ~180s
  is per-fork **import+transform** overhead, dominated by the `reactive` (happy-dom + Svelte-compile)
  vitest project. That cost is structural and is what `--changed` sidesteps at the gate, not the full run.

## Two DB flavors, two different porting shapes
- **shared.db** got a NEW `open_test_shared_db()` next to `open_shared_db` (which stays pure — it also
  opens the real on-disk file). ~65 test/in-source files were codemod'd off `open_shared_db(':memory:')`.
- **dict.db** already had a dedicated test helper `open_dictionary_db_in_memory(dict_id)`, so the
  template went INSIDE it (same name/signature) → zero call-site churn. It's also used at runtime by
  `/api/admin/schema/+server.ts`, which just gets faster. The dict template is migrations-only; the
  dict_id-specific `db_metadata` rows are still inserted per open (cheap).

## `--changed` blind spot (why the hook has a full-run fallback)
`import.meta.glob`-loaded files are NOT in vitest's changed-detection module graph. Verified on LD:
touching a shared migration `.sql` selects **0** test files. The hook greps `git status --porcelain`
for `\.sql$ | site/vitest.config.ts | site/package.json | pnpm-lock.yaml` → full suite; else `--changed`.

- The `.sql` migrations (shared/dict/history + the dict-client bundle) are the only real blind spot.
- **i18n locales are NOT a blind spot**: the tested code (`flatten_en`/`sync_en_catalog`) reads `en`
  via a **static** `import { en } from '$lib/i18n'` (which statically imports the `en.json` files), so
  EN-locale edits ARE traced. The lazy `import.meta.glob('$lib/i18n/locales/**/*.json')` in
  `seed_translations_if_empty` (non-EN JSON) has no test depending on it. If that ever changes, add
  `locales/**/*.json` to the trigger list.

If any new `import.meta.glob` data dependency is added to tested code, extend the trigger regex.

## Rejected alternatives (proven on house, don't re-derive)
`--pool=threads` (no help — import cost dominates), `--no-isolate` (faster but state-leakage failures),
external test caching (unnecessary — `--changed` no-op is ~3s), and deleting tests for speed (nothing
deserves it). See house's page for the audit.
