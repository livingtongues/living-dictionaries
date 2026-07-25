# Third-party editor callbacks fire during teardown → `state_unsafe_mutation`

Found twice on TipTap/ProseMirror (MarkdownEditor July 2026-07-02, RichTextEditor 2026-07-25 in
production), but the law is general to any library that calls us back synchronously.

## The mechanism

`svelte/src/internal/client/reactivity/sources.js` refuses a `set()` when `active_reaction` is a
`DERIVED | BLOCK_EFFECT | ASYNC | EAGER_EFFECT`. Destroying a component runs inside the **parent
block effect**, so `active_reaction` is set for the whole teardown — including any synchronous
callback a library fires from its `destroy()`. ProseMirror blurs the DOM on destroy and dispatches
that blur transaction synchronously, so an `onTransaction: () => tick++` throws
`state_unsafe_mutation` on navigation away from the page.

Notably this is NOT the classic "you mutated inside `$derived`" mistake the error message describes,
so the message sends you looking in the wrong place. The stack is the evidence: it will run
`library.destroy → … → your callback → svelte set → throw`, with no `$derived` of yours in sight.

## The fix pattern

`$lib/state/editor-tick.svelte.ts` (`create_editor_tick`), used by both editors:

- **defer** the mutation (`queueMicrotask`) — a microtask queued during a reaction always runs after
  that reaction completes, so the reactive context is gone by then, and
- **stop** it at teardown — set the flag FIRST, before `library.destroy()`, and drop pending +
  future callbacks (nothing will read the state again anyway).

Either half alone is fragile; the deferral covers callbacks fired from live reactive reads, the stop
flag covers teardown.

## Debugging note

Production minified stacks are still identifiable: fetch the named chunk
(`/_app/immutable/chunks/<hash>.js`) and grep near the callback name — the surrounding CSS class /
prop names tell you exactly which component it is. That is how the 2026-07-24 error was traced to
`RichTextEditor`, not the `MarkdownEditor` the issue had been filed against.
