# Pre-existing: Keyman/IPA keyboard `firstElementChild` race on fast edit-modal open/close

**Status:** FLAGGED (pre-existing, not introduced by the livedb scalar-field migration). Medium —
involves the Keyman + CKEditor keyboard lifecycle; needs care. Awaiting Jacob's call on priority.

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
