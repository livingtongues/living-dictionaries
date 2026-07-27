/**
 * Yield the Node event loop for one macrotask.
 *
 * `better-sqlite3` is synchronous: a query holds the single thread until it
 * returns, and a pipeline of them blocks EVERY other request for its whole run
 * — a learner's sync waits behind an admin opening a dashboard. (House measured
 * 27–33 s cold for the same aggregation shape on production, 2026-07-26; this
 * file is the shared fix, ported alongside `watermark-swr-cache.ts`.)
 *
 * Awaiting this between stages converts one long block into many short ones, so
 * the process stays responsive while the expensive work grinds through. It does
 * not make the work faster; it makes it polite.
 *
 * `setImmediate` (check phase) rather than `setTimeout(0)` or a microtask: it
 * runs after pending I/O callbacks, so queued requests actually get served in
 * the gap, and it can't starve the loop the way an awaited microtask would.
 */
export function breathe(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve))
}

if (import.meta.vitest) {
  describe(breathe, () => {
    it('resolves after yielding to the macrotask queue', async () => {
      const order: string[] = []
      const yielded = breathe().then(() => order.push('after-breathe'))
      // A microtask queued now must run BEFORE the breathe resolution.
      await Promise.resolve().then(() => order.push('microtask'))
      await yielded
      expect(order).toEqual(['microtask', 'after-breathe'])
    })

    it('lets an already-queued immediate callback run in the gap', async () => {
      const order: string[] = []
      setImmediate(() => order.push('other-work'))
      await breathe()
      expect(order).toEqual(['other-work'])
    })
  })
}
