import { create_render_pool } from './render-pool'
import type { PoolEvent } from './render-pool'

/**
 * The pool's failure modes, driven with STUB worker sources (a few lines of JS
 * each) rather than satori — what needs guarding here isn't the rasterizing, it
 * is that a wedged, dead, or unspawnable worker settles the caller's promise
 * fast and leaves the pool usable. `/og` degrades to its generic card on a
 * rejection; it hangs forever on a promise that never settles.
 */

const ECHO = `
  const { parentPort } = require('node:worker_threads')
  parentPort.on('message', ({ id, width }) => parentPort.postMessage({ type: 'done', id, png: new Uint8Array([width & 0xFF]) }))
`
const CRASHES = `
  const { parentPort } = require('node:worker_threads')
  parentPort.on('message', () => process.exit(3))
`
const NEVER_ANSWERS = `
  const { parentPort } = require('node:worker_threads')
  parentPort.on('message', () => {})
`
const REPORTS_FAILURE = `
  const { parentPort } = require('node:worker_threads')
  parentPort.on('message', ({ id }) => parentPort.postMessage({ type: 'failed', id, message: "Can't load image https://media.example/x.webp: fetch failed", stack: 'at satori' }))
`
const WARNS_THEN_SUCCEEDS = `
  const { parentPort } = require('node:worker_threads')
  parentPort.on('message', ({ id }) => {
    parentPort.postMessage({ type: 'warn', id, message: 'lookupType: 5 not supported', context: { retry: 'static_fonts_only' } })
    parentPort.postMessage({ type: 'done', id, png: new Uint8Array([1, 2, 3]) })
  })
`

const JOB = { markup: '<div></div>', height: 630, width: 1200 }

function make(source: string, overrides: Partial<Parameters<typeof create_render_pool>[0]> = {}) {
  const events: PoolEvent[] = []
  const pool = create_render_pool({
    source,
    worker_data: {},
    render_timeout_ms: 500,
    idle_shutdown_ms: 60_000,
    on_event: event => events.push(event),
    ...overrides,
  })
  return { pool, events }
}

describe(create_render_pool, () => {
  test('a render comes back as bytes, from a worker spawned on demand', async () => {
    const { pool } = make(ECHO)
    expect(pool.stats()).toMatchObject({ spawns: 0, alive: false })
    expect(await pool.render(JOB)).toEqual(new Uint8Array([1200 & 0xFF]))
    expect(pool.stats()).toMatchObject({ spawns: 1, in_flight: 0, alive: true })
    pool.shutdown()
  })

  test('one worker serves every render — spawning is not per-card', async () => {
    const { pool } = make(ECHO)
    await pool.render(JOB)
    await pool.render(JOB)
    await pool.render(JOB)
    expect(pool.stats().spawns).toBe(1)
    pool.shutdown()
  })

  test('a worker-side render failure rejects with ITS error, so the route can classify it', async () => {
    const { pool } = make(REPORTS_FAILURE)
    await expect(pool.render(JOB)).rejects.toThrow(/Can't load image/)
    // The worker is fine — one bad card must not cost the next one a respawn.
    expect(pool.stats()).toMatchObject({ spawns: 1, alive: true })
    pool.shutdown()
  })

  test('a non-fatal worker note (the static-font retry) is reported, not thrown', async () => {
    const { pool, events } = make(WARNS_THEN_SUCCEEDS)
    expect(await pool.render(JOB)).toEqual(new Uint8Array([1, 2, 3]))
    expect(events).toHaveLength(1)
    expect(events[0].message).toBe('og_render_failed')
    expect(events[0].context).toMatchObject({ retry: 'static_fonts_only' })
    pool.shutdown()
  })

  test('THE WEDGE CASE: a render that never answers times out and the worker is replaced', async () => {
    const { pool, events } = make(NEVER_ANSWERS, { render_timeout_ms: 100 })
    await expect(pool.render(JOB)).rejects.toThrow(/timed out after 100ms/)
    expect(pool.stats()).toMatchObject({ in_flight: 0, alive: false })
    expect(events.map(event => event.message)).toContain('og_render_worker_timeout')
    pool.shutdown()
  })

  test('a worker that dies mid-render rejects that render and the NEXT one respawns', async () => {
    const { pool, events } = make(CRASHES)
    await expect(pool.render(JOB)).rejects.toThrow(/exited with code 3/)
    expect(events.map(event => event.message)).toContain('og_render_worker_died')
    expect(pool.stats()).toMatchObject({ spawns: 1, alive: false })

    // Same pool, still usable — it just gets a fresh worker.
    const revived = create_render_pool({ source: ECHO, worker_data: {} })
    expect(await revived.render(JOB)).toEqual(new Uint8Array([1200 & 0xFF]))
    revived.shutdown()
  })

  test('a worker that cannot even be parsed rejects instead of taking the process with it', async () => {
    const { pool } = make('this is not javascript {{{')
    await expect(pool.render(JOB)).rejects.toThrow()
    pool.shutdown()
  })

  test('the worker is dropped after an idle stretch, and comes back for the next card', async () => {
    const { pool } = make(ECHO, { idle_shutdown_ms: 30 })
    await pool.render(JOB)
    await vi.waitFor(() => expect(pool.stats()).toMatchObject({ alive: false }))
    expect(await pool.render(JOB)).toEqual(new Uint8Array([1200 & 0xFF]))
    expect(pool.stats().spawns).toBe(2)
    pool.shutdown()
  })

  test('shutdown rejects whatever is in flight rather than leaving a hung promise', async () => {
    const { pool } = make(NEVER_ANSWERS, { render_timeout_ms: 60_000 })
    const pending = pool.render(JOB)
    pool.shutdown()
    await expect(pending).rejects.toThrow(/shut down/)
  })

  test('renders queued together all get their OWN answer (ids never cross)', async () => {
    const { pool } = make(ECHO)
    const [a, b, c] = await Promise.all([
      pool.render({ ...JOB, width: 1 }),
      pool.render({ ...JOB, width: 2 }),
      pool.render({ ...JOB, width: 3 }),
    ])
    expect([a[0], b[0], c[0]]).toEqual([1, 2, 3])
    pool.shutdown()
  })
})
