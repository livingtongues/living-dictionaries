# Cold-window scalar edits are silently dropped

Found 2026-07-12 while verifying the dict-session refactor (real achi.db, dev).

The entry page renders `entry = $derived($derived_entry ?? entry_from_page)` — until the live
read-model row swaps in, `entry` is the SSR/cold-fetched plain object. Scalar field edits
(EditFieldModal → mutate row + `_save()`) made in that window mutate the fallback object and are
**silently lost**: the modal closes, the UI even shows the typed value until navigation, no toast,
nothing persists. Repro: open an entry directly on a large dict, edit the phonetic within the
first ~seconds, reload — the edit is gone.

The facade ops (`page.data.writes`) are guarded (`still_loading` → toast + `write_blocked`
telemetry), but scalar saves deliberately bypass the facade ("mutate the live row + `_save()`"),
so they have NO readiness guard.

Related smaller wart (noted in .issues/deepen-client-write-seam.md): media add is upload-first —
a `still_loading` block on `insert_photo` toasts only AFTER the modal already closed
(upload succeeded, DB row dropped).

Possible directions (not decided):
- gate the EditFieldModal save path on the same `is_loading()` used by guarded-writes (toast like
  facade ops) — smallest, consistent
- make field-blocks non-editable (visually pending) until `$derived_entry` is live
- queue cold-window edits and replay onto the live row when it arrives (most work, best UX)

Not a regression — this predates the media/write-seam/dict-session refactors.
