# Speed up the pre-commit test gate (port from house)

Porting house's proven+approved commit-gate speedup (house session 2026-07-09) to LD.
Reference: house `.knowledge/tooling/test-suite-performance.md` + `.issues/speed-up-commit-gate-tests.md`.

## Two levers (same as house)
1. **Template-serialize** the per-test DB open: migrate once per process → `db.serialize()` →
   `new Database(buf)` per test (~2ms) instead of re-running migrations each `beforeEach`.
2. **`vitest run --changed`** in the pre-commit hook, with a full-suite fallback when
   non-graph-traceable files change (`.sql` migrations via `import.meta.glob`, vitest config,
   package.json, lockfile).

## LD structure (audited 2026-07-10)
- Two hot DB flavors: **shared.db** (11 migrations) + per-**dictionary** dict.db (4 migrations).
  History migrations (1) not hot in tests.
- shared open helper: `src/lib/db/server/shared-db.ts` → `open_shared_db(path | ':memory:')`.
- dict open helper: `src/lib/db/server/dictionary-db.ts` → runtime `get_dictionary_db(id)` +
  test helper **`open_dictionary_db_in_memory(dict_id)`** (already exists; runs migrations + inserts
  db_metadata dictionary_id/schema_version).
- `run_sql_migrations` shared by both; wraps each migration in BEGIN/COMMIT with FKs OFF.
- Hook: `.githooks/pre-commit` currently runs `pnpm test:site --run` (full suite) + check + lint:fix.
- Vitest has TWO projects (`unit` + `reactive`), config at `site/vitest.config.ts`.

### Call-site inventory
- `open_shared_db(':memory:')` in ~60 files (test `beforeEach` + in-source `import.meta.vitest`).
  Type refs `ReturnType<typeof open_shared_db>` in ~50 files (some in source files —
  chat-notify.ts, chat-reping-cron.ts — those are runtime helper types, DO NOT rename).
- `open_dictionary_db_in_memory(dict_id)` in ~30 files. Also used at RUNTIME in
  `src/routes/api/admin/schema/+server.ts` (schema introspection) — so keep its name/signature.
- File-based tests (wal-checkpoint-cron, log-analytics DATA_DIR, log-retention-cron archive,
  r2-snapshot-builder snapshot read) open their own `new Database(path)` directly — NOT via
  `open_shared_db(<file>)`. So NO shared file-template variant needed (unlike house).

## Plan
- ✅ 1. Baseline captured (see below).
- ✅ 2. shared.db: added `open_test_shared_db()` to `shared-db.ts` (module-level serialized template;
      re-applies `busy_timeout` + `foreign_keys=ON` per connection). Codemod converted 65 files
      (`:memory:` call sites + `ReturnType<typeof …>` type refs + 5 dynamic `await import`
      destructures). The chat-notify/chat-reping-cron type refs were inside their
      `import.meta.vitest` blocks (test-only) → converted safely.
- ✅ 3. dict.db: rewrote `open_dictionary_db_in_memory` internals to template-serialize (migrate once
      → serialize → restore per call + re-apply FK pragma + insert db_metadata rows). Same
      name/signature → zero dict call-site codemod. Benefits the runtime schema endpoint too.
- ✅ 4. `.githooks/pre-commit` test stage → `vitest run --changed` with full-run fallback when
      `git status --porcelain` shows `.sql` / `site/vitest.config.ts` / `site/package.json` /
      `pnpm-lock.yaml`. check + lint:fix + re-stage unchanged.
- ✅ 5. Verified (below).
- ✅ 6. Zero tests deleted. Knowledge → `.knowledge/tooling/test-suite-performance.md`.

## Baseline numbers (mustang, 2 vCPU, 2026-07-10)
- Per-open microbench: **shared.db 42.4ms → 0.18ms** template (235×); **dict.db 58.3ms → ~0.2ms**.
- Full `vitest run` (json+time wrapped): wall **229.5s** / in-test sum **51.7s** / 209 files.

## After numbers
- Full `vitest run`: wall **213.7s** / in-test sum **31.3s** (−20s) / **1463 passed, 0 failed**.
  Wall barely moves because the dominant cost (~180s) is per-fork import+transform overhead
  (LD's `reactive` happy-dom project) — structural, and sidestepped at the gate by `--changed`.
- Targeted DB-heavy batch (72 files / 568 tests): in-test bucket **20s**.

## Verification
- ✅ Full suite green before AND after (0 failures).
- ✅ `--changed` blind spot confirmed: touch a shared migration `.sql` → "No test files found" (0
      selected) → the hook's `.sql` full-run fallback is essential.
- ✅ `--changed` tracing confirmed: touch `sync-helpers.ts` → selects 4 dependent test files, 10.3s.
- ✅ i18n EN locale JSON is a **static** import via `$lib/i18n` → traceable by `--changed` (NOT a
      blind spot); the lazy `seed_translations_if_empty` non-EN glob has no test depending on it.
      So `.sql` is LD's only glob blind spot — trigger list matches house.
- ✅ Hook trigger regex validated against synthetic paths (sql/config/lock → FULL, source → CHANGED).
- ✅ ESLint clean on all 67 touched files; my changes add 0 type errors.

## Note (not my scope)
`pnpm check` currently reports 6 pre-existing errors in another session's WIP
(`routes/[dictionaryId]/home/` — dict-home-card-redesign, tracked in
`.issues/dict-home-card-redesign.md`). None are files I touched; left for that agent.
