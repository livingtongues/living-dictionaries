# 2026-07-02 pre-cutover migration squash (idempotent-initial convention)

All three migration sets were squashed to a single `20260702_initial.sql` each
(`shared-migrations/`, `dictionary-migrations/`, `history-migrations/`) days before the
platform cutover. Full work log: `.issues/squash-sql-migrations-pre-cutover.md`.

## The convention that made it safe (and why it matters later)

Migration runners apply **by name**, so a renamed/squashed file re-executes over every
already-migrated DB (prod, local `.data`, browser wa-sqlite/OPFS DBs). The squashed initials
are therefore **fully idempotent**: `IF NOT EXISTS` everywhere, `DROP TRIGGER IF EXISTS` +
re-create for `process_delete_cascade`, `INSERT OR IGNORE` seeds, zero `ALTER TABLE`. That
re-execution is the convergence mechanism — it was verified (schema-diff script) that
applying the new initial over an old-chain DB yields a byte-equivalent schema.

Consequences:

- **Existing DBs self-healed**; only their `migrations` tables were rewritten afterward
  (prod shared.db / river.db / river.history.db + local `.data`) to the single new row.
  Prod's ghost `20260526_messages.sql` row (the dictionary_partners drift incident) is gone.
- Each initial ends with a **"Convergence" section** (`DROP INDEX IF EXISTS` for indexes the
  audit removed, plus the relationship-tombstone sweep in the dict initial). **Prune those
  sections after cutover** once no pre-squash DB exists.
- Column order gotcha: columns that were `ALTER TABLE ... ADD COLUMN`ed pre-squash
  (`users.notify_channel`, client_logs geo cols, message_threads triage cols,
  `sentences.sources`, `texts.sources`) sit at the **end** of their CREATE TABLE so fresh
  DBs match pre-squash DBs' column order exactly.

## 2026-07-02 schema audit outcomes (why some indexes don't exist)

- Junction tables get **no index on the UNIQUE natural key's leading column** — the UNIQUE
  autoindex serves lookups + FK-cascade scans (verified with EXPLAIN QUERY PLAN, including
  `entry_relationships.from_entry_id` riding the expression-index's plain leading column).
- dict.db `deletes` is indexed on bare `(updated_at)` (pull + prune are table-agnostic);
  shared.db `deletes` keeps `(table_name, updated_at)` (its pull IS table-filtered). They
  differ on purpose.
- `entries.elicitation_id` + `entry_relationships.{from_sense,to_sense,custom_type}` have
  partial indexes (v1 filter + FK-cascade scans).
- Deliberately NOT done (revisit post-cutover with real data verified): CHECK enforcing
  audio/videos single-parent XOR; `tags.name` stays plain TEXT (legacy parity) while
  `dialects.name` is a MultiString.

## entry_count is maintained at ONE chokepoint

`mirror_dictionary_cursor` (`$lib/db/server/v1-route-context.ts`) recounts `entries` and
writes `entry_count` alongside the `updated_at` mirror on **every** dict write — both the
`/api/dictionary/[id]/changes` editor push and all `/api/v1` writes route through it. The
cutover import stamps counts once at import; there is no heal cron. If a new write path ever
bypasses `mirror_dictionary_cursor`, counts will drift again.
