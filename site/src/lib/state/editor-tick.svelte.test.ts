import { flushSync } from 'svelte'
import { describe, expect, test } from 'vitest'
import { create_editor_tick } from './editor-tick.svelte'

/**
 * Regression cover for the production `state_unsafe_mutation` of 2026-07-24: a
 * TipTap blur transaction fired while the component was being destroyed inside
 * a parent block effect, and the unguarded `tick++` in `onTransaction` threw.
 * Both halves of the guard are law here — a bump must never mutate inside the
 * caller's reactive context, and teardown must swallow bumps entirely.
 */

const flush_microtasks = () => new Promise(resolve => queueMicrotask(() => resolve(undefined)))

describe(create_editor_tick, () => {
  test('a bump lands after the current task, not during it', async () => {
    const ticker = create_editor_tick()

    ticker.bump()
    expect(ticker.value).toBe(0)

    await flush_microtasks()
    expect(ticker.value).toBe(1)
  })

  test('bumping from inside a reactive read context does not throw', async () => {
    const ticker = create_editor_tick()

    const cleanup = $effect.root(() => {
      // A `$derived` hits the same `set()` guard branch as the block effect that
      // destroys a component's children — a synchronous mutation here throws
      // state_unsafe_mutation.
      const toolbar_state = $derived.by(() => {
        ticker.bump()
        return ticker.value > 0
      })
      // Reading it evaluates the derived — an unguarded bump throws right here.
      const read_toolbar_state = () => toolbar_state
      expect(read_toolbar_state()).toBeFalsy()
    })

    await flush_microtasks()
    flushSync()
    expect(ticker.value).toBe(1)
    cleanup()
  })

  test('blur immediately followed by teardown never mutates state', async () => {
    const ticker = create_editor_tick()

    ticker.bump() // ProseMirror's blur transaction
    ticker.stop() // the component is destroyed in the same synchronous turn

    await flush_microtasks()
    expect(ticker.value).toBe(0)
  })

  test('transactions after teardown are ignored', async () => {
    const ticker = create_editor_tick()

    ticker.stop()
    ticker.bump()

    await flush_microtasks()
    expect(ticker.value).toBe(0)
  })
})
