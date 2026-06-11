# `dict_write` — worker-side atomic multi-table writes (LD)

The last correctness item from `.issues/opfs-db-follow-ups.md`: multi-statement logical writes
(`operations.ts` entry+sense, sentence+junction, media+junction, link/unlink) issue several `exec`
RPCs — each is op-mutex-serialized in the leader worker but the GROUP isn't atomic, and the
SAVEPOINT batches in `dict-live-db` `#insert`/`#upsert` span multiple RPCs so a sync
apply-transaction can interleave (BEGIN inside an open savepoint txn → that sync round errors).

House's `library_write` is the template (`~/code/house/site/src/lib/db/client/admin-instance.ts`
`run_library_write` + `admin-writes.ts` facade + `library-writes.ts` orchestrators +
`library-writes.test.ts` in-memory better-sqlite3 test pattern).

## Design decisions (made this session)

- **Op-dispatch worker-side, house-faithful.** New `{ type: 'dict_write', op, args }` in the
  `DbRequest` union (`dict-client/worker/instance.ts` — LD-specific file, NOT one of the 4
  byte-identical harness files; no house sync needed). Handler in `dict-instance.ts`: op-mutex +
  `BEGIN/COMMIT` (ROLLBACK on error) + emit `tables_changed`/`rows_deleted` + `sync_if_needed()`.
- **ALL `.insert()`/`.upsert()` route worker-side** via generic `insert_rows`/`upsert_rows` ops —
  one insert code path, deletes the SAVEPOINT machinery + `#check_id_column` from dict-live-db
  entirely (kills the savepoint race at the root). Stamping (id/dirty/updated_at/audit cols +
  stringify) moves into `dict-writes.ts`.
- **Dedicated semantic ops** for the multi-table groups: `insert_entry` (entry+first sense),
  `insert_sentence` (+`senses_in_sentences`), `insert_photo` (+`sense_photos`), `insert_video`
  (+`sense_videos` + optional `video_speakers`), `insert_audio` (+ optional `audio_speakers`),
  `link_junction` / `unlink_junction` (read-then-write made atomic; key-based args
  `{ table, key: { col: val } }`, table allowlisted).
- **Speaker assignment folded into media ops** — `helpers/media.ts` `addAudio`/`uploadVideo`
  currently chain insert + assign as two non-atomic calls; now one atomic op via optional
  `speaker_id`.
- **Single-statement writes stay on `exec`** (`_save`, `.update`, `.delete` tombstones) — already
  atomic per statement.
- Orchestrators return `{ result, affected_tables, deleted_rows? }`; worker emits events (fan to
  all tabs incl. originator), facade also notifies locally for snappiness (idempotent re-query).
  Results returned parsed (JSON cols as objects — structured clone carries them fine).
- `user_id` injected per call by the `DictLiveDb.writes` facade (it owns `#user_id`).

## Files

- ✅ `site/src/lib/db/dict-client/dict-writes.ts` — NEW: orchestrators + `dispatch_dict_write`
- ✅ `site/src/lib/db/dict-client/dict-writes.test.ts` — NEW: 14 tests on in-memory better-sqlite3
      (`open_dictionary_db_in_memory` gives real migrations + `process_delete_cascade` trigger);
      stamping, group rollback (sentence+junction, batch, audio+speaker), link/unlink idempotency
      + tombstone cascade, allowlist rejection, unknown op
- ✅ `worker/instance.ts` — added `dict_write` to `DbRequest`
- ✅ `dict-instance.ts` — `case 'dict_write'` handler (BEGIN/COMMIT under op-mutex, ROLLBACK on
      error, events + `sync_if_needed`); updated stale "NOT atomic" header comment
- ✅ `worker-connection.ts` — `dict_write(op, args)` on `DictConnection`
- ✅ `dict-live-db.svelte.ts` — `#insert`/`#upsert` → worker ops; SAVEPOINT machinery +
      `#check_id_column` deleted; typed `writes` facade added (`DictWrites`)
- ✅ `operations.ts` — bodies are single `dict_db.writes.X()` calls; get_pieces guard,
      alert/confirm/goto kept; explicit `randomUUID()` ids dropped (auto-gen)
- ✅ `helpers/media.ts` — `speaker_id` folded into atomic `insert_audio`/`insert_video`
- ✅ `dict-sync-engine.ts` — stale mid-flight comment updated (clear-dirty-by-id invariant stands:
      writes can still land during the network phase, just not during the apply-txn)
- ✅ Docs: database SKILL.md (folder map + read-model section), knowledge opfs page
      ("whole-op atomicity NOT gained yet" → gained 2026-06-11), follow-ups item checked off

## Verification — ALL GREEN

- ✅ vitest 406 (66 files, +14 new) · tsc 0 · eslint 0 · svelte-check 0 errors (18 pre-existing warnings)
- ✅ `tools/e2e/opfs-dict-editor.mjs` extended: dict_write insert_entry (entry+sense atomic through
      the real worker RPC), insert_rows, link_junction idempotency, unlink tombstone+trigger,
      tables_changed broadcast to follower, dirty-cleared-by-id after push, net-zero cleanup —
      ALL PASS. Also added a sync retry loop to the final cleanup (`sync_now` no-ops while a
      background sync is in flight — pre-existing harness race, was the only flake).
- ✅ e2e smoke + heal — ALL PASS

## Incident handled during verification

The first editor-e2e run hit the pre-existing cleanup flake and left its `opfs-edit-…` phonetic
marker in the dev server's `nukuoro.db` (pushed but never restored). Fixed directly
(`phonetic = NULL` + fresh `updated_at`; trigger bumped the sync cursor) and verified zero
`opfs-e2e`/`e2e-dialect`/`opfs-edit-` leftovers. Relevant because dev pushes snapshots to PROD R2
while `R2_SNAPSHOT_BUILDER_ENABLED=true` (the standing P0 in `.issues/opfs-db-follow-ups.md` —
Jacob still needs to flip that flag off in `site/.env`).

## Status: ✅ implementation + verification complete — not committed
