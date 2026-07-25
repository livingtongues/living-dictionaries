/**
 * Reactive "something changed in the editor" counter for TipTap toolbars
 * (`RichTextEditor`, `MarkdownEditor`): their active/can-undo deriveds read it
 * so a transaction re-evaluates them.
 *
 * ProseMirror dispatches transactions SYNCHRONOUSLY from wherever it happens to
 * be called — including the blur it fires while the editor's DOM is being torn
 * down, which in Svelte 5 runs inside the parent block effect. Mutating `$state`
 * from a derived/block-effect context throws `state_unsafe_mutation` (seen in
 * production 2026-07-24 leaving an admin message thread), so:
 *
 * - `bump()` defers the mutation out of whatever reactive context it was called
 *   in (a queued microtask always runs after the current reaction finishes), and
 * - `stop()` — called first thing in the component's teardown — drops pending
 *   and future bumps, since nothing will read them again anyway.
 */
export function create_editor_tick() {
  let tick = $state(0)
  let stopped = false

  return {
    /** Read this in toolbar deriveds to re-run them on every transaction. */
    get value() {
      return tick
    },
    /** Call from the editor's `onTransaction`. */
    bump() {
      if (stopped)
        return
      queueMicrotask(() => {
        if (!stopped)
          tick++
      })
    },
    /** Call at the START of teardown, before `editor.destroy()`. */
    stop() {
      stopped = true
    },
  }
}
