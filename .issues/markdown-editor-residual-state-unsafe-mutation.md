# Residual MarkdownEditor state mutation during message-editor blur

The 2026-07-24 production log review found one current-build `state_unsafe_mutation` for Cailie
Keating while leaving an admin message thread:

`Uncaught Error: https://svelte.dev/e/state_unsafe_mutation`

The stack runs through Tiptap/ProseMirror `onTransaction` during `blur`. Current
`MarkdownEditor.svelte` already has a July 2 guard for this exact family: it defers `tick++` with
`queueMicrotask` because a synchronous blur transaction can run inside Svelte's
template/derived context. The current-build occurrence proves either that a microtask still inherits
the unsafe reactive context in this teardown path or that another mutation in the callback chain is
responsible.

Plan:

- [ ] Reproduce by opening an admin message thread containing the markdown editor, editing/focusing
  it, and navigating back to `/admin/messages` while blur/teardown runs.
- [ ] Use an untracked/deferred boundary that demonstrably exits Svelte's derived context, or isolate
  the actual alternate mutation if `tick++` is not the remaining source.
- [ ] Add a component regression test covering blur followed immediately by component destruction.
- [ ] Verify the admin message workflow in a browser and watch production for no recurrence on the
  deployed build.

Severity: P3 — one administrator, one current-build occurrence, no evidence of lost content or a
blocked workflow.
