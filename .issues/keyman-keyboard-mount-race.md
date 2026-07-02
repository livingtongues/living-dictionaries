# Pre-existing: Keyman/IPA keyboard `firstElementChild` race on fast edit-modal open/close

**Status:** ✅ RESOLVED 2026-07-02 as part of the CKEditor→Tiptap migration
(`.issues/ckeditor-to-tiptap.md`). Keyman.svelte now: fixes the `resolve` → `resolve()` bug, adds a
`destroyed` teardown flag (async onMount bails after unmount), clears the target-poll interval on
destroy, and the Tiptap `MarkdownEditor` mounts synchronously (static imports) so the
`.ProseMirror` target exists on the first query — the poll is now only a safety net. Verified by
the `test:markdown` e2e (Keyman Assamese typing into the notes editor).

## Symptom
Opening an entry/sense edit field modal and closing it quickly throws an uncaught
`TypeError: Cannot read properties of null (reading 'firstElementChild')` (also can be `querySelector`
on null). Surfaced via the Phase-3 e2e (table gloss edit, programmatic fill + immediate Save). A human
editing normally is unlikely to hit it; the edit still SAVES correctly. Phase-2's slower detail-screen
gloss edit did NOT trip it — it's timing-sensitive.

## Root cause (likely)
`src/lib/components/keyboards/keyman/Keyman.svelte`:
- `targetInput()` does `inputEl = wrapperEl.querySelector(target)` then `wrapperEl.firstElementChild`.
- `waitForCKEditorToInitAndBeTargeted()` runs a `setInterval` (every 500ms, up to 10 attempts) that calls
  `wrapperEl.querySelector(target)`. If the modal unmounts before the interval clears, the next tick
  touches a now-null `wrapperEl` → throw.
  - Secondary bug in the same fn: `resolve` is referenced without calling it (`resolve` vs `resolve()`),
    so the promise never resolves even on success — the loop only ends via `attempts > MAX_ATTEMPTS`.
- `src/lib/components/keyboards/ipa/IpaKeyboard.svelte` accesses `wrapperEl.firstElementChild` too (but
  guarded + only on keyboard-button clicks).
- `src/lib/svelte-pieces/functions/IntersectionObserverShared.svelte:40` also reads
  `container.firstElementChild` (separate code path; lower suspicion here).

## Suggested fix (when prioritized)
- Null-guard `wrapperEl` in `targetInput()` and inside the interval callback; clear the interval on
  `onDestroy`; fix `resolve` → `resolve()`. Keep a teardown flag so the async setup bails after unmount.

## Not doing now
Out of scope for the livedb scalar-field migration; the migration only swapped the persistence call,
not the edit-modal/keyboard internals.
