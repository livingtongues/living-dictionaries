/**
 * A hard cap on how much of the Node thread share-card rendering may consume:
 * at most `limit` renders at once, AND at most `busy_ratio` of any recent
 * window spent rendering at all.
 *
 * WHY (2026-07-27, `.issues/og-endpoint-load-outages.md`): satori and resvg are
 * BOTH synchronous — a card render is ~700–840 ms of the single Node thread and
 * nothing yields. Measured inside the production container, 8 concurrent renders
 * stretched to 5.0–5.7 s each and dragged `/healthz` (which returns the string
 * "ok" and touches nothing) to 3,251 ms. Caddy's active health check times out at
 * 2 s, so it marked BOTH containers down and had nowhere to send traffic: 1,553
 * refused requests, 21 signed-in users' edits failing to sync, five times in one
 * evening.
 *
 * MEASURED HERE (2026-07-28, production build, 2-core box — the same core count
 * as the VPS), and the reason this file has two mechanisms instead of one:
 *
 *  - A burst of N distinct cards does NOT arrive as N concurrent handlers. The
 *    thread is blocked inside render #1 while the other connections sit in the
 *    accept queue, so handler #2 only runs once #1 has finished AND released.
 *    Every render logged `wait_ms: 0` — a pure concurrency limit is then a
 *    no-op, because Node's single thread already enforced it.
 *  - What actually hurt is the BACKLOG: 20 new cards = 38 s of back-to-back
 *    rendering, and a `/healthz` that lands behind it waited up to 28 s. That is
 *    the production failure, and no per-instant concurrency number prevents it.
 *
 * So the load shed is time-based: renders may occupy at most `busy_ratio` of the
 * last `busy_window_ms`. Past that the endpoint refuses to render at all until
 * the window drains, and the caller sends a card that costs zero CPU. Jacob's
 * ruling: a scraper getting a plainer card is strictly better than the site
 * going down. The concurrency limit stays as the cheap structural guarantee that
 * two renders can never interleave if a future edit adds an `await` mid-render.
 */

export interface RenderSlot {
  /** MUST be called in a `finally` — the queue stalls forever otherwise. */
  release: () => void
}

/** Why a caller was refused — surfaced in `og_render_shed` telemetry. */
export type ShedReason = 'busy_window' | 'queue_full' | 'wait_deadline'

export interface RenderQueue {
  /** A slot, or `null` when the process has no CPU to spare for a card. */
  acquire: () => Promise<RenderSlot | null>
  stats: () => { active: number, waiting: number, busy_ms: number, last_shed: ShedReason | null }
}

interface Waiter {
  resolve: (slot: RenderSlot | null) => void
  timer: ReturnType<typeof setTimeout>
}

export function create_render_queue({ limit, wait_deadline_ms, max_waiting, busy_window_ms, busy_ratio, now = Date.now }: {
  limit: number
  wait_deadline_ms: number
  max_waiting: number
  /** Sliding window the render budget is measured over. */
  busy_window_ms: number
  /** Fraction of that window renders may occupy (0.5 = never more than half the thread). */
  busy_ratio: number
  /** Injectable clock — tests drive the window without sleeping through it. */
  now?: () => number
}): RenderQueue {
  let active = 0
  let last_shed: ShedReason | null = null
  const waiting: Waiter[] = []
  /** Completed renders inside the window: [ended_at, duration]. */
  const recent: { ended_at: number, ms: number }[] = []

  function busy_ms(): number {
    const cutoff = now() - busy_window_ms
    while (recent.length && recent[0].ended_at < cutoff)
      recent.shift()
    return recent.reduce((total, entry) => total + entry.ms, 0)
  }

  function over_budget(): boolean {
    return busy_ms() > busy_window_ms * busy_ratio
  }

  function grant(): RenderSlot {
    const started_at = now()
    return {
      release: once(() => {
        recent.push({ ended_at: now(), ms: now() - started_at })
        active--
        const next = waiting.shift()
        if (!next)
          return
        clearTimeout(next.timer)
        active++
        /**
         * Hand the slot over on the CHECK phase (`setImmediate`), never a
         * microtask: resolving the next waiter directly chains two synchronous
         * renders inside one loop iteration, so the loop never reaches its poll
         * phase and a queued `/healthz` waits for the WHOLE queue instead of one
         * card. (This is the last home of that reasoning: `$lib/server/breathe.ts` was deleted
         * 2026-07-30 with the analytics cache machinery it existed for.)
         */
        setImmediate(() => next.resolve(grant()))
      }),
    }
  }

  return {
    acquire() {
      // The budget comes first: when the process has already spent its share of
      // the window on cards, nobody renders, queued or not.
      if (over_budget()) {
        last_shed = 'busy_window'
        return Promise.resolve(null)
      }
      if (active < limit) {
        active++
        return Promise.resolve(grant())
      }
      if (waiting.length >= max_waiting) {
        last_shed = 'queue_full'
        return Promise.resolve(null)
      }

      return new Promise<RenderSlot | null>((resolve) => {
        const waiter: Waiter = {
          resolve,
          timer: setTimeout(() => {
            const index = waiting.indexOf(waiter)
            if (index !== -1)
              waiting.splice(index, 1)
            last_shed = 'wait_deadline'
            resolve(null)
          }, wait_deadline_ms),
        }
        waiting.push(waiter)
      })
    },
    stats: () => ({ active, waiting: waiting.length, busy_ms: busy_ms(), last_shed }),
  }
}

/** A double release would let two renders run at once — the exact thing this prevents. */
function once(fn: () => void): () => void {
  let called = false
  return () => {
    if (called)
      return
    called = true
    fn()
  }
}

if (import.meta.vitest) {
  describe(create_render_queue, () => {
    const make = (overrides: Partial<Parameters<typeof create_render_queue>[0]> = {}) =>
      create_render_queue({ limit: 1, wait_deadline_ms: 50, max_waiting: 4, busy_window_ms: 10_000, busy_ratio: 0.5, ...overrides })

    test('the first caller renders immediately', async () => {
      const queue = make()
      expect(await queue.acquire()).not.toBe(null)
      expect(queue.stats().active).toBe(1)
    })

    test('a second caller waits, then runs the moment the first releases', async () => {
      const queue = make({ wait_deadline_ms: 5000 })
      const first = await queue.acquire()
      const second_promise = queue.acquire()
      expect(queue.stats().waiting).toBe(1)
      first?.release()
      expect(await second_promise).not.toBe(null)
      expect(queue.stats().waiting).toBe(0)
    })

    test('THE HANDOFF YIELDS TO THE EVENT LOOP — renders never chain in a microtask', async () => {
      // A microtask handoff chains two synchronous renders inside one loop
      // iteration, so the loop never reaches its poll phase and a queued request
      // waits for the whole burst instead of one card.
      const queue = make({ wait_deadline_ms: 5000 })
      let second_started = false
      const first = await queue.acquire()
      const second = queue.acquire().then(() => { second_started = true })
      first?.release()
      await Promise.resolve()
      await Promise.resolve()
      expect(second_started).toBe(false)
      await second
      expect(second_started).toBe(true)
    })

    test('a waiter past the deadline gets null instead of piling onto the CPU', async () => {
      const queue = make({ wait_deadline_ms: 20 })
      await queue.acquire()
      expect(await queue.acquire()).toBe(null)
      expect(queue.stats().last_shed).toBe('wait_deadline')
    })

    test('a saturated queue refuses instantly — the burst never queues without bound', async () => {
      const queue = make({ wait_deadline_ms: 5000, max_waiting: 2 })
      await queue.acquire()
      const queued = [queue.acquire(), queue.acquire()]
      expect(await queue.acquire()).toBe(null)
      expect(queue.stats()).toMatchObject({ active: 1, waiting: 2, last_shed: 'queue_full' })
      void queued
    })

    test('never more than `limit` renders at once, under a burst of 8', async () => {
      const queue = make({ limit: 1, wait_deadline_ms: 5000, max_waiting: 16 })
      let concurrent = 0
      let peak = 0
      await Promise.all(Array.from({ length: 8 }, async () => {
        const slot = await queue.acquire()
        if (!slot)
          return
        concurrent++
        peak = Math.max(peak, concurrent)
        await new Promise(resolve => setTimeout(resolve, 5))
        concurrent--
        slot.release()
      }))
      expect(peak).toBe(1)
      expect(queue.stats()).toMatchObject({ active: 0, waiting: 0 })
    })

    test('a double release cannot smuggle in a second concurrent render', async () => {
      const queue = make({ wait_deadline_ms: 5000 })
      const slot = await queue.acquire()
      slot?.release()
      slot?.release()
      expect(queue.stats()).toMatchObject({ active: 0, waiting: 0 })
    })

    describe('the render budget — what actually protects /healthz', () => {
      /** Drives the injected clock so a 10 s window is exercised in microseconds. */
      function fake_clock() {
        let time = 1_000_000
        return { now: () => time, advance: (ms: number) => { time += ms } }
      }

      test('THE FIX: a backlog of new cards is shed once renders own half the window', async () => {
        const clock = fake_clock()
        const queue = make({ busy_window_ms: 10_000, busy_ratio: 0.5, now: clock.now })
        // Six 800 ms renders = 4.8 s, still inside the 5 s budget.
        for (let i = 0; i < 6; i++) {
          const slot = await queue.acquire()
          expect(slot).not.toBe(null)
          clock.advance(800)
          slot?.release()
        }
        expect(queue.stats().busy_ms).toBe(4800)
        const seventh = await queue.acquire()
        expect(seventh).not.toBe(null) // 4.8 s is not yet OVER 5 s
        clock.advance(800)
        seventh?.release()
        // 5.6 s of the last 10 s — the endpoint now costs nobody anything.
        expect(await queue.acquire()).toBe(null)
        expect(queue.stats().last_shed).toBe('busy_window')
      })

      test('the budget refills as the window slides — shedding is temporary, never sticky', async () => {
        const clock = fake_clock()
        const queue = make({ busy_window_ms: 10_000, busy_ratio: 0.5, now: clock.now })
        for (let i = 0; i < 7; i++) {
          const slot = await queue.acquire()
          clock.advance(800)
          slot?.release()
        }
        expect(await queue.acquire()).toBe(null)
        clock.advance(10_001) // the whole window rolls past
        expect(queue.stats().busy_ms).toBe(0)
        expect(await queue.acquire()).not.toBe(null)
      })

      test('a crawler discovering 100 new cards gets a bounded number of renders, not 100', async () => {
        const clock = fake_clock()
        const queue = make({ busy_window_ms: 10_000, busy_ratio: 0.5, now: clock.now })
        let rendered = 0
        let shed = 0
        for (let i = 0; i < 100; i++) {
          const slot = await queue.acquire()
          if (!slot) {
            shed++
            clock.advance(1) // a shed response is ~free
            continue
          }
          rendered++
          clock.advance(800)
          slot.release()
        }
        expect(rendered).toBe(7)
        expect(shed).toBe(93)
      })
    })
  })
}
