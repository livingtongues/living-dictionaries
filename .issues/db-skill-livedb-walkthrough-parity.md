# DB skill parity: full LiveDb walkthrough in house + living, audit all three

Goal: tutor's "Accessing Data → Query Accessor Properties" walkthrough should exist
and be accurate in **house** and **living**; audit all three for staleness +
report API differences (esp. composite keys) for Jacob to flag.

## Verified facts (from code, not docs)

### Accessors per repo
- **tutor**: one `LiveDb` (`client/live/live-db.svelte.ts`), shared.db, `page.data.db`. Types from `@tutor/shared`.
- **house**: one `LiveDb`, shared.db, `page.data.db` (+ read-only ViewerLiveDb for snapshot, no write methods).
- **living**: TWO — `LiveDb` (shared.db, `page.data.db`, /admin/*) AND `DictLiveDb` (`dict-client/dict-live-db.svelte.ts`, per-dict dict.db, `page.data.dict_db`, [dictionaryId]/*).

### Composite-key tables (TABLE_PRIMARY_KEYS)
- tutor: `words` → (word, language)
- house: `deletes`(table_name,id), `subscriptions`(user_id), `db_metadata`(key), `email_aliases`(email)
- living shared.db: `deletes`(table_name,id), `db_metadata`(key), `email_aliases`(email)
- living dict.db (DictLiveDb): NONE — every table has a synthetic UUID `id` PK. No composite handling at all.

### Method matrix
| | tutor | house | living shared | living dict.db |
|---|---|---|---|---|
| `.merge()` | ✓ | ✓ | ✓ | ✗ (not in DictTableAccessor) |
| `.composite_query()` | ✓ | ✓ | ✗ | ✗ |
| composite `.id()/.update()` via object key | ✓ | ✓ | ✓ | n/a |
| `.delete()` composite | throws (append-only) | throws | throws | n/a |
| auto-stamp dirty/updated_at/id | ✓ | ✓ | ✓ | ✓ |
| auto-stamp created_by/updated_by_user_id | ✗ | ✗ | ✗ | ✓ (syncable tables, from #user_id) |

### Delete semantics
- tutor / house / living-shared: hard `DELETE FROM table WHERE id` + `INSERT INTO deletes` tombstone (immediate local removal). Composite tables throw.
- living dict.db: TWO representations.
  - Real soft-delete used by app = `.update({ id, deleted: <ISO> })` (sets `deleted TEXT` col; revivable; table stores filter `WHERE deleted IS NULL`). Used in `operations.ts` (delete_sentence, junction unlink/revive).
  - DictLiveDb `.delete()`/`_delete()` = only `INSERT OR REPLACE INTO deletes` tombstone; does NOT set `deleted` nor remove local row. On sync the tombstone causes a hard `DELETE` everywhere. **These methods are UNUSED in the app** (all `._delete()` call sites are admin/page.data.db). Latent inconsistency.

## Stale/inaccurate doc items found
1. **tutor SKILL** Table Accessor Properties table MISSING `.merge()`, auto-stamp note, composite-key note — code has all three (`words` composite). tutor's own "gold" doc is behind house's.
2. **living SKILL** L164-165 "identical API shape, differing only in which DB they wrap and whether they expose write methods" — both write; APIs differ (merge, composite, auto-stamp, delete).
3. **living SKILL** L206 `.delete()` "soft-delete (writes to deletes)" — misleading; that's a hard-delete tombstone; real soft-delete = `.update({ deleted })`.
4. **house SKILL** redundant duplicate sector tables (L94-99 and L108-112).

## Plan
- ✅ Living: replaced condensed "The accessor API" with full walkthrough (dict_db-centric + shared.db differences callout) [Q1].
- ✅ Tutor: added `.merge()` row + auto-stamp note + composite-key note [Q2].
- ✅ Living: fixed stale L164-165 ("identical API shape") + delete bullets.
- ✅ House: verified walkthrough (already complete & accurate); deduped the two sector tables.
- ✅ Code fix [Q3]: `DictLiveDb.delete()` / `_delete()` now soft-delete via the `deleted` column
  (route through `#update`), matching `operations.ts` — the snapshot-safe path. NOT the `deletes`
  tombstone (that resurrects rows on snapshot load — see below).
- ✅ Knowledge: updated `.knowledge/migration/dict-sync-invariants.md` (delete-now stale line + resurrection gap).
- ✅ Follow-up issue created: `.issues/dict-tombstone-path-incomplete.md` (decide: remove dead tombstone infra vs complete permanent-purge).

## Verification
- `pnpm check` (svelte-check): 0 errors.
- `pnpm exec vitest run src/lib/db`: 52 passed.
- eslint on dict-live-db.svelte.ts: 0 errors (pre-existing interface-arg warnings only).
- No DictLiveDb reactive unit test added: living's vitest project config has no Svelte-rune plugin
  (no `.svelte.ts` test imports exist). The change reuses the production-proven `#update({deleted})`
  path (identical to `operations.ts` `delete_sentence`); `.delete()`/`_delete()` were unused in-app.

## Follow-up: DB knowledge-file audit (duplication / staleness / gaps)
Audited all DB-related `.knowledge` files in living + house (tutor unchanged).

Staleness fixed:
- ✅ living `m4-write-sync.md` — "no R2 (yet)" section (R2 dict snapshots are now live).
- ✅ living `m4-sqlite-read-layer.md` — superseded banner (entries-data endpoint retired in M4-write).
- ✅ living `migration/index.md` — m4-write description "(no R2)" corrected.
- ✅ living `dict-sync-invariants.md` — done earlier (delete-now-soft + resurrection gap).
- ✅ house `admin-sync-engine.md` — sectors table was stuck in "Phase 1" (missing `library`, `email_aliases`, `message_attachments`); now 3-sector + points to skill for roster.
- ✅ house `db-layering.md` — rewritten: removed stale table (listed nonexistent `sessions`, missed library + viewer), de-duplicated the skill, kept only rationale (co-location, two-server-DB split, one-migration-folder).
- ✅ house `messages-schema.md` — de-phased (inbound email is LIVE: `email-inbound`/`reply`/`compose` + cf-worker populate RFC headers); fixed `source`, RFC-fields section, intro; added "schema is in code" disclaimer over the column tables.
- ✅ house `architecture/index.md` — db-layering + messages-schema descriptions updated.

Verified current / valuable (kept as-is): house `sync-deletes.md`, `sqlite-migration-gotchas.md`,
`local-first-library-editing.md`, viewer-*.md (no stale markers), tooling/sqlite-*.md.

Trims executed (after Jacob's go-ahead):
- ✅ house `messages-schema.md`: replaced the three column-by-column tables (mirrored `shared.ts`) with
  a compact "non-obvious column conventions" section; kept all rationale (snapshotting, email_aliases,
  admin-outbound, nullable FKs, RFC). Title → "conventions + rationale".
- ✅ house `livedb-id-reactivity-gotcha.md`: trimmed the duplicated why/examples (now a long code
  comment in `live-db.svelte.ts`); kept the 6a8d549 regression history + symptom + test idea.
- ✅ house `per-user-db.md`: realigned the whole doc as the `/learn-from` blueprint (all paths
  `/learn-from/...`, not `/site/...`); dropped the dormant-status framing the skill already carries.

Gaps: none significant — DB knowledge is comprehensive. The one new gap (dict delete architecture)
was already captured in `dict-sync-invariants.md` + `.issues/dict-tombstone-path-incomplete.md`.

## Reconciling Q3 prose vs click
Jacob's prose ("any local data needs to be done through delete tombstones") and the Q3 click ("set
deleted + drop locally, matching operations.ts") land on the SAME place: the `deleted` column IS the
working tombstone for dict.db (a deletion timestamp that syncs + survives snapshots). The separate
`deletes` TABLE is the broken one. Implemented the `deleted`-column path.
