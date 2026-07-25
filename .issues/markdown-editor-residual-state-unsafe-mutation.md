# Residual editor `state_unsafe_mutation` during blur + teardown — FIXED (2026-07-25)

The 2026-07-24 production log review found one current-build `state_unsafe_mutation` for Cailie
Keating while leaving an admin message thread:

`Uncaught Error: https://svelte.dev/e/state_unsafe_mutation`

## What it actually was (evidence, not guesswork)

The issue was originally filed against `MarkdownEditor.svelte` (whose July 2 `queueMicrotask` guard
targets this exact family) with the premise that the guard was insufficient. **That premise was
wrong.** Pulling the row from production `logs.db` and de-minifying the deployed chunk named in the
stack (`_app/immutable/chunks/B_n0hZTd.js`) showed the throwing component was
**`$lib/components/ui/RichTextEditor.svelte`** — `rich-text-editor-content`, `toolbar: 'email'`,
`on_keydown`/`on_paste` props, i.e. the admin message reply editor:

```js
onTransaction: () => { n(z) }   // ← plain synchronous tick++, NO guard
```

The July 2 fix was only ever applied to `MarkdownEditor`. Chain:
`j.blur → dispatch → dispatchTransaction → emit → onTransaction → tick++ → throw`.

Why it throws: navigating away destroys the page inside the parent **block effect**; teardown blurs
the DOM; ProseMirror dispatches that blur transaction SYNCHRONOUSLY; Svelte's `set()` refuses a
mutation while `active_reaction` is a `DERIVED | BLOCK_EFFECT | ASYNC | EAGER_EFFECT`
(`svelte/src/internal/client/reactivity/sources.js`).

- ✅ **Reproduced** headlessly against dev (`/tmp/ld-editor-repro.mjs`): open the thread, focus the
  editor, type, click the back link → `state_unsafe_mutation` in `page.on('pageerror')`.

## Fix

- ✅ One shared, tested primitive: `$lib/state/editor-tick.svelte.ts` (`create_editor_tick()`) —
  `bump()` defers out of the caller's reactive context, `stop()` drops pending + future bumps.
- ✅ `RichTextEditor.svelte` and `MarkdownEditor.svelte` both use it; `stop()` runs FIRST in both
  teardown paths (`onDestroy` and the `onMount` cleanup) before `editor.destroy()`.
- ✅ Regression test `src/lib/state/editor-tick.svelte.test.ts` (reactive project): bump lands a
  microtask later, bump from inside a derived does not throw, **blur followed immediately by
  teardown never mutates**, post-teardown bumps ignored. Verified it FAILS against a synchronous
  `tick++` (3 of 4 cases).
- ✅ Browser re-verified (`/tmp/ld-editor-verify.mjs`): zero page errors on the same navigation, and
  both editors still work — typing + Bold/Italic toolbar active state still tracks through the
  deferred tick (screenshots `/tmp/ld-rich-text-verify.png`, `/tmp/ld-markdown-verify.png`).

## Watch

Confirm no recurrence in production once the build carrying this deploys (query `client_logs` for
`state_unsafe_mutation` on the new `app_version`).
