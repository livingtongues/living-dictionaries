# Deepen the client write seam — dissolve operations.ts into a guarded writes facade

**Status: assigned to a spawned session (run AFTER `.issues/deepen-media-upload-pipeline.md` lands
— it touches the same files). Recommendation strength: STRONG.**

## Problem

`DictLiveDb.writes` (`site/src/lib/db/dict-client/dict-live-db.svelte.ts`, `get writes()`) is
already the deep module — typed, atomic, one `dict_write` RPC per logical write, client-side id
stamping. But components reach it through a shallow 500-line ring:

- `site/src/lib/db/dict-client/operations.ts` (509 lines): 27 exported functions, each =
  `try { get_pieces(); …one real line…; track(...) } catch { alert(err); console.error(err) }`.
  28 `alert(err)` calls. `get_pieces()` reads `page.data` (dictionary, dict_db, connection,
  auth_user, entries_data) — global coupling that makes the whole file untestable.
- `site/src/lib/db-operations.ts`: a barrel re-exporting those 27 fns (+ 3 media fns) as the
  `db_operations` object.
- Dict `+layout.ts` returns `db_operations` (the static import!) through layout data; components
  read `page.data.db_operations`; then `get_pieces()` reads `page.data` AGAIN. The injection is
  circular — it exists only as a story-mock seam (`lib/mocks/db.ts` `log_db_operations`).

So the call chain is: component → `page.data.db_operations` → barrel → `operations.ts` →
(back to `page.data`) → `dict_db.writes` → transport RPC → `dict-writes.ts`. Four cross-cutting
concerns (readiness guard, telemetry, error UX, navigation) are hand-copied into 27 bodies.

## Inventory of `operations.ts` exports (all 27)

insert_entry, delete_entry, insert_sense, delete_sense, insert_sentence, update_sentence,
delete_sentence, insert_audio, update_audio, delete_audio, insert_speaker, assign_speaker,
insert_tag, assign_tag, insert_source, update_source, remove_source_and_delete,
insert_relationship, delete_relationship, insert_dialect, assign_dialect, insert_photo,
update_photo, delete_photo, insert_video, update_video, delete_video

They fall into distinct shapes — study each before moving it:

1. **Facade passthroughs** (insert_entry, insert_sentence, insert_audio, insert_photo,
   insert_video, insert_text is facade-only) → `dict_db.writes.*`
2. **Table-accessor ops** (delete_* via `dict_db.<table>.delete`, insert_sense/speaker/tag/
   dialect/source via `dict_db.<table>.insert`, update_* via `dict_db.<table>.update`)
3. **Junction link/unlink** (assign_speaker, assign_tag, assign_dialect) →
   `dict_db.writes.link_junction` / `unlink_junction`
4. **Multi-step reads + writes** (insert_relationship — canonicalization via
   `relationship-canonicalize.ts` + duplicate check via `connection.query`;
   remove_source_and_delete — cross-table scrub). These have real logic worth keeping.
5. **Special UX**: insert_entry does `goto(...)` after create; insert_entry/delete_entry `track()`
   ENTRY_CREATED/ENTRY_DELETED (`$lib/debug/log-events`); `get_pieces()` logs `write_blocked`
   telemetry with reasons still_loading / no_dict_db / not_signed_in.

## Design

**One guarded facade, constructed once in the dict `+layout.ts`, with explicit deps.** Roughly:

```ts
// site/src/lib/db/dict-client/guarded-writes.ts  (name flexible)
export function create_guarded_writes({ dict_db, connection, dictionary, get_user_id, is_loading, on_error }: {
  dict_db: DictLiveDb | null
  connection: DictConnection | null
  dictionary: { id: string, url: string }
  get_user_id: () => string | undefined
  is_loading: () => boolean            // from entries_ui loading store
  on_error: (err: unknown) => void     // toast (replaces the 28 alert()s)
}): GuardedWrites
```

- ONE interceptor wraps every op: readiness guard (`write_blocked` telemetry with the same
  reason strings — they're queried in log reviews, keep them byte-identical), error routing to
  `on_error`, and rethrow-or-swallow semantics matching today (today alert()s then swallows —
  keep swallowing so callers don't start crashing, but route to toast).
- The 27 ops become one-liners inside the factory (or a generic
  `guard(fn)` applied over a plain object of ops). The real logic of shape-4 ops
  (insert_relationship, remove_source_and_delete) moves in as-is — extract their pure parts
  (duplicate-check SQL, scrub sequencing) into small named fns in the same file.
- `insert_entry`'s `goto` moves OUT to the calling component(s) (`AddEntry.svelte`,
  `EntriesEmptyState.svelte`, search empty state — grep `insert_entry` callers): the facade
  returns the created entry; navigation is a UI concern.
- Layout returns `writes` (the facade) via layout data — same mockability seam, but now the mock
  implements a typed interface instead of mirroring a module. Update `app.d.ts` PageData typing.
- KEEP `page.data.db_operations` name OR rename to `page.data.writes` — renaming is better;
  update all consumers (39 files matched `db_operations` on 2026-07-12 — components, stories,
  `lib/mocks/db.ts`, `lib/mocks/layout.ts`, `app.d.ts`). Stories mock via
  `lib/mocks/layout.ts` — keep story rendering working (svelte-look).

### Error UX

Replace `alert(err)` with the toast system (`$lib/state/toast.svelte.ts`) wired through
`on_error` at facade construction. One place decides presentation. Keep `console.error` (it's
patched by remote-log → telemetry).

### Deletions when finished

- `site/src/lib/db/dict-client/operations.ts` (fully dissolved)
- `site/src/lib/db-operations.ts` (barrel gone)
- The media fns (`addImage`/`addAudio`/`uploadVideo` or their post-refactor successors from the
  media-upload session) leave the barrel — components import the media module directly, or the
  facade exposes them; prefer direct imports (feature-owned).

### Coordination

- Run AFTER the media-upload session (`.issues/deepen-media-upload-pipeline.md`) — it edits
  `helpers/media.ts`, `db-operations.ts`, `mocks/db.ts` too.
- A follow-up session will restructure `+layout.ts` into a `dict-session` module
  (`.issues/deepen-dict-session.md`). Keep the facade construction in `+layout.ts` simple and
  self-contained so that session can lift it wholesale.

## Tests

`guarded-writes.test.ts` against `memory-connection.ts` (already exists in `dict-client/`) + a
real `create_dict_live_db`, or a stub dict_db where simpler:

- blocked writes: not signed in / dict_db null / still loading → op rejects-or-noops AND
  `write_blocked` telemetry fires with the right reason (spy on `log_warning`)
- errors from the connection route to `on_error` exactly once; no unhandled rejections
- `insert_relationship` duplicate-check: inserting the same canonicalized pair twice → second is
  a no-op (this is currently only enforceable by reading the SQL)
- `remove_source_and_delete` scrubs the slug from referencing rows before deleting (assert with
  real memory-connection rows)
- junction assigns are idempotent (`linked: false` second time)

## Session progress (2026-07-12)

Inventory re-checked against the working tree (step 1 media refactor landed uncommitted):
`operations.ts` still exports all 27 fns; `db-operations.ts` barrel has no media entries anymore;
`lib/media/add-media.ts` imports `insert_photo`/`insert_audio`/`insert_video` DIRECTLY from
`operations.ts` — it must move to the facade too (new coordination point not in the plan above).

Decisions:
- Rename `page.data.db_operations` → `page.data.writes`; type `GuardedWrites =
  ReturnType<typeof create_guarded_writes>` from `$lib/db/dict-client/guarded-writes.ts`.
- `add_photo`/`add_audio`/`add_video` gain a `writes: Pick<GuardedWrites, 'insert_…'>` option —
  callers pass `page.data.writes`; add-media tests now stub the pick instead of `vi.mock`.
- `insert_entry` returns the entry; `goto` moved to the single call site (entries/+page.svelte
  `add_entry` wrapper feeding AddEntry + EntriesEmptyState).
- `delete_entry(entry_id)` now REQUIRES the id (entry/+page.svelte passes `entry.id`) — removes the
  facade's `page.params`/`page.state` coupling; `entry_id_from_page` fallback deleted.
- `delete_sentence`'s `confirm()` moved to its one caller (EntrySentence.svelte) — UI concern.
- Blocked-write UX: ONE toast per blocked write (friendly message per reason; `still_loading` keeps
  the old alert text) instead of the old double-alert; `write_blocked` telemetry reason strings +
  context shape byte-identical.
- `on_error` in +layout.ts = `toast.error(message)`; guard keeps `console.error` (remote-log patch).
- Deleted the stale commented-out block in EditImage.svelte that referenced
  `db_operations.update_audio` on an image file (dead + wrong API).

Checklist:
- ✅ `guarded-writes.ts` facade (guard interceptor + 27 ops + extracted pure helpers)
- ✅ `guarded-writes.test.ts` (blocked reasons/telemetry, error routing, relationship dedupe,
      source scrub, junction idempotency — better-sqlite3 in-memory + dispatch_dict_write adapter)
- ✅ `+layout.ts` constructs facade, returns `writes`; `app.d.ts` updated
- ✅ add-media.ts + test take `writes` pick
- ✅ All component/story consumers renamed (36 files)
- ✅ mocks/db.ts → `log_writes`; mocks/layout.ts updated
- ✅ DELETE operations.ts + db-operations.ts
- ✅ pnpm test (1516) / tsc / lint / check — all clean
- ✅ svelte-look stories render (EditSource, AddSpeaker, EditImage, EditAudio + the batch verified pre-abort)
- ✅ Manual dev flow (seam e2e: still_loading race blocked with toast, create→navigate, sense/sentence
      add+delete with component-level confirm, delete entry, gone from list; zero page errors) +
      `write_blocked` telemetry rows land in logs.db with reason/context shape intact
      (`not_signed_in` covered by unit tests — UI gates edit affordances when signed out)

COMPLETED 2026-07-12 — session 092eafc8 was aborted mid-verification during the button-codemod
clobber incident; the watcher session (d040331b) restored the clobbered .svelte consumers from
this session's JSONL and finished verification. See .issues/clobber-recovery-2026-07-12.md.
NOTE for the loading-guard UX (pre-existing semantics, surfaced by e2e): media upload is
unguarded and the modal closes optimistically, so a still_loading block toasts AFTER the modal
closed (upload succeeded, insert dropped). Consider an up-front readiness check in add-media.

## Verification

- `pnpm test`, `tsc`, `pnpm lint`, `pnpm check`
- svelte-look stories that mock db_operations still render (EditSource, AddSpeaker, GalleryEntry,
  AddVideo, EditAudio, EditImage, ListEntry, AddRelatedEntryModal, sources page…)
- Manual dev flow as an editor (see `dev-auth` skill): create entry (navigates), add sense,
  gloss edit, add sentence, assign tag/dialect/speaker, add related entry, delete entry. Verify
  `write_blocked` still logs when signed out (check via `check-logs` skill on local logs.db).
