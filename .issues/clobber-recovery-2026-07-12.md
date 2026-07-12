# Recovery from the button-codemod `git checkout` clobber (2026-07-12)

At 03:14:41Z the button-migration agent (43f6879a) ran `git checkout --` on all tracked
`*.svelte` files matching `HeadlessButton|ui/Button.svelte`, reverting uncommitted edits from the
step-1 (media pipeline, 58d969a8) and step-2 (write-seam, 092eafc8) refactor sessions. The same
compound command then re-applied its icon-inline strip + fa-codemod, and later its fixed
btn-codemod, so damaged files are HEAD+button-codemod, not clean HEAD. All `.ts`/`.stories.ts`
work survived (revert was `--include="*.svelte"` only).

Step 1's session noticed and already re-repaired: EditAudio.svelte, AddVideo.svelte,
EditImage.svelte (mostly), Partners.svelte — wired to step 2's GuardedWrites conventions.
Remaining damage = 13 svelte-check errors in 5 files + silent stale refs in 5 more.

Recovery (this watcher session, d040331b, executes directly per Jacob):

- ✅ Reconstructed timeline + per-file fix list from the three session JSONLs (originalFile/old/new pairs)
- ✅ Mechanical `db_operations`→`writes` re-rename (reverted files that only needed the perl):
  - ✅ EntryDisplay.svelte (+ `DbOperations` import → `GuardedWrites` from `$lib/db/dict-client/guarded-writes`, prop type)
  - ✅ sources/+page.svelte
  - ✅ lib/components/media/AddSpeaker.svelte
  - ✅ lib/components/video/PlayVideo.svelte
  - ✅ lib/components/sources/EditSource.svelte
- ✅ Replay step 2's manual edits (from JSONL):
  - ✅ entries/+page.svelte — destructure `writes`, add `add_entry(lexeme)` wrapper (goto after create), `{add_entry}` to EntriesEmptyState + AddEntry, imports MultiString/goto
  - ✅ entries/AddEntry.svelte — drop DbOperations import, prop `add_entry: (lexeme: MultiString) => Promise<void>`
  - ✅ entry/[entryId]/+page.svelte — `writes` destructure, `writes.delete_entry(entry.id)`, pass `{writes}`
  - ✅ EditImage.svelte — removed dead commented modal-footer block; `writes: page.data.writes` in add_photo was already restored by step 1
- ✅ Keyman.svelte + IpaKeyboard.svelte — converted the tab/select HeadlessButtons (sync handlers) to plain `<button class="btn-ghost btn-sm" class:active>` + scoped `.active` tint (repo pattern per SwitchView/SearchScopeChips); removed Keyman's now-unused HeadlessButton import
- ✅ Verify: pnpm check 0 errors, pnpm test 1516 passed, tsc clean, pnpm lint clean (ran `lint --fix` for 88 codemod-whitespace errors + added missing each-key in admin/icon-review)
- ✅ Re-run step 1's aborted final verification (dev media flow /tmp/ld-dev-media-flow.mjs) — PASS
  (photo happy path via dev_mock, audio with existing speaker, killed-PUT error path; rows synced to
  server achi.db). Script now retries through the loading-guard window — the "failure" step 1 had
  messaged step 2 about was the guard blocking `insert_photo` while the real achi.db entries bundle
  was still loading, not a seam bug.
- ✅ Finish step 2's remaining verification — seam e2e PASS + write_blocked telemetry verified in
  logs.db; step 2's create-entry failure WAS clobber-induced (reverted entries/+page.svelte read
  `data.db_operations` = undefined). Step 2 issue checklist now fully ✅.
- UX gap noted (pre-existing semantics): media upload is unguarded + modal closes optimistically →
  a still_loading block toasts after close (upload succeeded, DB insert dropped).
- ✅ Step 3 (.issues/deepen-dict-session.md) — executed in this session: dict-lifecycle merged into
  new `dict-session.ts` (one per-dict lifecycle module), layout 265→142 lines, 9 new unit tests,
  all gates green, real-data e2e verify PASS (2-context pull-update, leader hand-off, audit
  re-stamp verified in server db). Pre-existing cold-window scalar-edit data loss found and logged
  in .issues/cold-window-scalar-edit-loss.md.
- [ ] Button-migration finish (Jacob's call — 43f6879a is idle holding phases; needs his glyph
  picks via /admin/icon-review)

Files verified NOT reverted (retain step-2 state): EntryMedia.svelte, EntriesTable.svelte,
Cell.svelte, ListEntry.svelte, View.svelte, EntriesEmptyState.svelte, EntrySentence.svelte,
EntryTag.svelte, EntryDialect.svelte, RelatedEntries.svelte, AddRelatedEntryModal.svelte,
Sense.svelte, GalleryEntry.svelte. dict-live-db.svelte.ts line 288 `db_operations` mention is a
deliberate comment — leave.

Do NOT commit — Jacob commits when ready.
