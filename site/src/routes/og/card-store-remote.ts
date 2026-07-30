import { GetObjectCommand, NoSuchKey, PutObjectCommand } from '@aws-sdk/client-s3'
import { get_r2_og_cache, og_cache_is_configured } from '$lib/server/r2-og-cache'
import { record_og_event } from './og-telemetry'

/**
 * The share-card store's DURABLE tier: R2.
 *
 * WHY (2026-07-30, `.issues/og-card-store-on-r2.md`): the card space is 1,291
 * dictionaries + 589,990 entries ≈ 104 GB of cards against 76 GB of free disk,
 * so the disk store could never be anything but a cache. Held at 1,000 entries
 * it was permanently full and permanently evicting: 18,174 renders/day for
 * 1,000 slots and **55% of all `/og` requests shed to the generic card**. Disk
 * stays as the hot tier; this is where a card actually lives.
 *
 * EVERY PATH FAILS OPEN. No creds, no bucket, `NoSuchKey`, a timeout, a 5xx, a
 * DNS fault — all of it reads as a plain MISS, exactly like an unreadable file,
 * and we render. A failed write never fails a response that already holds a good
 * PNG. That property is why this file catches everything and returns null.
 *
 * Three bounds keep an R2 outage from costing more than it saves:
 *  - a DEADLINE on every call, because an untimed fetch can hold for the ~21 s OS
 *    connect timeout (the font-fetch lesson from `.issues/og-endpoint-load-outages.md`);
 *  - a consecutive-fault CIRCUIT BREAKER, so an R2/Cloudflare outage adds one
 *    timeout to the first few misses rather than to every single one;
 *  - a bounded NEGATIVE CACHE, so a scraper retrying a genuinely-absent card
 *    every 60 s doesn't re-GET it every time.
 */

/** A GET must never cost more than the render it is trying to avoid. */
const GET_TIMEOUT_MS = 2000
/** A PUT is off the request path entirely, so it can afford to be patient. */
const PUT_TIMEOUT_MS = 5000
/** Consecutive faults (not misses) before we stop calling R2 for a while. */
const BREAKER_FAULTS = 5
const BREAKER_OPEN_MS = 30_000
/** How long a known-absent key stays known-absent. */
const NEGATIVE_TTL_MS = 60_000
const NEGATIVE_LIMIT = 500

/** Content-addressed already (`card_key`), so the prefix is only housekeeping. */
export function remote_card_object_key(key: string): string {
  return `cards/${key}.png`
}

export interface RemoteCardEvent {
  message: 'og_remote_card_fault'
  error?: unknown
  context?: Record<string, unknown>
}

export interface RemoteCardStore {
  /** The stored card, or null for ANY miss — absent, unconfigured, or faulted. */
  read: (key: string) => Promise<Uint8Array | null>
  /** Fire-and-forget: schedules the PUT and returns immediately. */
  write: (args: { key: string, png: Uint8Array }) => void
  stats: () => { configured: boolean, breaker_open: boolean, consecutive_faults: number, absent_keys: number, gets: number, puts: number, faults: number }
  /** Tests: forget the breaker + negative cache. */
  reset: () => void
}

export function create_remote_card_store({
  get_object,
  put_object,
  is_configured,
  now = Date.now,
  get_timeout_ms = GET_TIMEOUT_MS,
  put_timeout_ms = PUT_TIMEOUT_MS,
  breaker_faults = BREAKER_FAULTS,
  breaker_open_ms = BREAKER_OPEN_MS,
  negative_ttl_ms = NEGATIVE_TTL_MS,
  negative_limit = NEGATIVE_LIMIT,
  on_event,
}: {
  get_object: (args: { key: string, signal: AbortSignal }) => Promise<Uint8Array | null>
  put_object: (args: { key: string, png: Uint8Array, signal: AbortSignal }) => Promise<void>
  is_configured: () => boolean
  now?: () => number
  get_timeout_ms?: number
  put_timeout_ms?: number
  breaker_faults?: number
  breaker_open_ms?: number
  negative_ttl_ms?: number
  negative_limit?: number
  on_event?: (event: RemoteCardEvent) => void
}): RemoteCardStore {
  let consecutive_faults = 0
  let breaker_open_until = 0
  let gets = 0
  let puts = 0
  let faults = 0
  /** key → the moment we may ask about it again. Insertion-ordered = oldest first. */
  const absent_until = new Map<string, number>()

  function notify(event: RemoteCardEvent) {
    try {
      on_event?.(event)
    } catch {
      // telemetry must never be the thing that breaks a card
    }
  }

  function usable(): boolean {
    if (!is_configured())
      return false
    return now() >= breaker_open_until
  }

  function record_fault({ error, context }: { error: unknown, context: Record<string, unknown> }) {
    faults++
    consecutive_faults++
    if (consecutive_faults >= breaker_faults) {
      breaker_open_until = now() + breaker_open_ms
      consecutive_faults = 0
    }
    notify({ message: 'og_remote_card_fault', error, context: { ...context, breaker_open: now() < breaker_open_until } })
  }

  function record_success() {
    consecutive_faults = 0
  }

  function remember_absent(key: string) {
    if (absent_until.size >= negative_limit)
      absent_until.delete(absent_until.keys().next().value)
    absent_until.set(key, now() + negative_ttl_ms)
  }

  function known_absent(key: string): boolean {
    const until = absent_until.get(key)
    if (until === undefined)
      return false
    if (now() >= until) {
      absent_until.delete(key)
      return false
    }
    return true
  }

  /**
   * The deadline is enforced HERE as well as by the abort signal: aborting asks
   * the client to stop, racing guarantees the caller moves on either way. A
   * share card must never be able to hold a request longer than rendering it.
   */
  async function with_deadline<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error(`r2 og cache call exceeded ${ms}ms`))
      }, ms)
      timer.unref?.()
    })
    try {
      return await Promise.race([run(controller.signal), deadline])
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    async read(key) {
      if (!usable() || known_absent(key))
        return null
      gets++
      try {
        const png = await with_deadline(get_timeout_ms, signal => get_object({ key, signal }))
        record_success()
        if (!png)
          remember_absent(key)
        return png
      } catch (error) {
        record_fault({ error, context: { operation: 'get' } })
        return null
      }
    },

    write({ key, png }) {
      if (!usable())
        return
      // Off the request path, same pattern as the disk prune: the response is
      // already on its way out and must never wait on R2.
      setTimeout(() => {
        puts++
        void with_deadline(put_timeout_ms, signal => put_object({ key, png, signal }))
          .then(() => {
            record_success()
            absent_until.delete(key)
          })
          .catch(error => record_fault({ error, context: { operation: 'put' } }))
      }, 0).unref?.()
    },

    stats: () => ({
      configured: is_configured(),
      breaker_open: now() < breaker_open_until,
      consecutive_faults,
      absent_keys: absent_until.size,
      gets,
      puts,
      faults,
    }),

    reset() {
      consecutive_faults = 0
      breaker_open_until = 0
      gets = 0
      puts = 0
      faults = 0
      absent_until.clear()
    },
  }
}

/**
 * The two S3 calls, with the client resolved per call so tests can hand in a
 * fake one and still exercise the real command construction + response handling.
 */
export function create_r2_transport({ get_client }: { get_client: typeof get_r2_og_cache }) {
  return {
    async get_object({ key, signal }: { key: string, signal: AbortSignal }): Promise<Uint8Array | null> {
      const { client, bucket } = get_client()
      try {
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: remote_card_object_key(key) }), { abortSignal: signal })
        if (!response.Body)
          return null
        return await response.Body.transformToByteArray()
      } catch (error) {
        // An absent card is the normal cold state, and a bucket that doesn't
        // exist yet (Jacob provisions it) must behave exactly like an empty one.
        if (error instanceof NoSuchKey || is_absent_error(error))
          return null
        throw error
      }
    },

    async put_object({ key, png, signal }: { key: string, png: Uint8Array, signal: AbortSignal }): Promise<void> {
      const { client, bucket } = get_client()
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: remote_card_object_key(key),
        Body: png,
        ContentType: 'image/png',
        // Matches the endpoint's own contract: the key is content-addressed, so
        // the bytes behind it never change.
        CacheControl: 'public, immutable, max-age=31536000',
      }), { abortSignal: signal })
    },
  }
}

function is_absent_error(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name
  const status = (error as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata?.httpStatusCode
  return name === 'NoSuchKey' || name === 'NotFound' || name === 'NoSuchBucket' || status === 404
}

export const remote_card_store: RemoteCardStore = create_remote_card_store({
  ...create_r2_transport({ get_client: get_r2_og_cache }),
  is_configured: og_cache_is_configured,
  // Fail-open must not mean fail-SILENT: a store that quietly stopped storing
  // looks exactly like a store that is working (the same blindness that let the
  // disk tier thrash for weeks). Coalesced, so an R2 outage costs one row a
  // minute, not one per card.
  on_event: ({ message, error, context }) => record_og_event({ level: 'warn', message, error, context }),
})

if (import.meta.vitest) {
  const PNG = new Uint8Array([0x89, 0x50, 0x4E, 0x47])

  function make({ get_object, put_object, configured = true, ...overrides }: Partial<Parameters<typeof create_remote_card_store>[0]> & { configured?: boolean } = {}) {
    const events: RemoteCardEvent[] = []
    const store = create_remote_card_store({
      get_object: get_object ?? (() => Promise.resolve(PNG)),
      put_object: put_object ?? (() => Promise.resolve()),
      is_configured: () => configured,
      on_event: event => events.push(event),
      ...overrides,
    })
    return { store, events }
  }

  describe(create_remote_card_store, () => {
    test('a stored card comes back; an absent one is a plain null', async () => {
      const { store } = make()
      expect(await store.read('hit')).toEqual(PNG)

      const { store: empty } = make({ get_object: () => Promise.resolve(null) })
      expect(await empty.read('miss')).toBe(null)
    })

    test('NO CREDENTIALS is disk-only, not an error (local dev, and before the bucket exists)', async () => {
      const calls: string[] = []
      const { store } = make({
        configured: false,
        get_object: ({ key }) => {
          calls.push(key)
          return Promise.resolve(PNG)
        },
      })
      expect(await store.read('k')).toBe(null)
      store.write({ key: 'k', png: PNG })
      expect(calls).toEqual([])
    })

    test('a fault is a MISS, never a throw — a dead R2 renders, it does not 500', async () => {
      const { store, events } = make({ get_object: () => Promise.reject(new Error('ECONNREFUSED')) })
      expect(await store.read('k')).toBe(null)
      expect(events[0].message).toBe('og_remote_card_fault')
      expect(events[0].context?.operation).toBe('get')
    })

    test('a hung GET settles at the deadline instead of holding the request', async () => {
      const { store } = make({
        get_timeout_ms: 10,
        get_object: () => new Promise<never>(() => undefined), // never settles
      })
      const started = Date.now()
      expect(await store.read('k')).toBe(null)
      expect(Date.now() - started).toBeLessThan(2000)
    })

    test('an aborted GET is told to stop, not just abandoned', async () => {
      let aborted = false
      const { store } = make({
        get_timeout_ms: 10,
        get_object: ({ signal }) => new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true
            reject(new Error('aborted'))
          })
        }),
      })
      await store.read('k')
      expect(aborted).toBe(true)
    })

    test('the breaker opens after consecutive faults and stops calling R2, then recovers', async () => {
      let calls = 0
      let clock = 1_000_000
      const { store } = make({
        breaker_faults: 3,
        breaker_open_ms: 5000,
        now: () => clock,
        get_object: () => {
          calls++
          return Promise.reject(new Error('R2 is down'))
        },
      })
      for (let i = 0; i < 3; i++)
        await store.read(`k${i}`)
      expect(calls).toBe(3)
      expect(store.stats().breaker_open).toBe(true)

      await store.read('k-while-open')
      expect(calls).toBe(3) // not called at all while open

      clock += 5001
      expect(store.stats().breaker_open).toBe(false)
      await store.read('k-after')
      expect(calls).toBe(4)
    })

    test('a known-absent key is not re-fetched until its TTL expires', async () => {
      let calls = 0
      let clock = 1_000_000
      const { store } = make({
        negative_ttl_ms: 1000,
        now: () => clock,
        get_object: () => {
          calls++
          return Promise.resolve(null)
        },
      })
      expect(await store.read('cold')).toBe(null)
      expect(await store.read('cold')).toBe(null)
      expect(calls).toBe(1)

      clock += 1001
      expect(await store.read('cold')).toBe(null)
      expect(calls).toBe(2)
    })

    test('the negative cache is bounded — a scraper walking 100k absent keys cannot grow it', async () => {
      const { store } = make({ negative_limit: 10, get_object: () => Promise.resolve(null) })
      for (let i = 0; i < 50; i++)
        await store.read(`absent-${i}`)
      expect(store.stats().absent_keys).toBe(10)
    })

    test('the PUT is not awaited, and a failed PUT never surfaces', async () => {
      const written: string[] = []
      const { store, events } = make({
        put_object: ({ key }) => {
          written.push(key)
          return Promise.reject(new Error('R2 rejected it'))
        },
      })
      expect(() => store.write({ key: 'k', png: PNG })).not.toThrow()
      expect(written).toEqual([]) // scheduled, not run inline
      await vi.waitFor(() => expect(written).toEqual(['k']))
      await vi.waitFor(() => expect(events.some(event => event.context?.operation === 'put')).toBe(true))
    })

    test('a successful write forgets that the key was absent', async () => {
      let present = false
      const { store } = make({
        get_object: () => Promise.resolve(present ? PNG : null),
        put_object: () => {
          present = true
          return Promise.resolve()
        },
      })
      expect(await store.read('k')).toBe(null) // caches "absent"
      store.write({ key: 'k', png: PNG })
      await vi.waitFor(async () => expect(await store.read('k')).toEqual(PNG))
    })
  })

  describe(remote_card_object_key, () => {
    test('keys live under one prefix so the bucket stays sortable', () => {
      expect(remote_card_object_key('abc123')).toBe('cards/abc123.png')
    })
  })

  describe(create_r2_transport, () => {
    /** A stand-in S3 client: records the command it was sent, answers with `respond`. */
    function fake_client(respond: (input: Record<string, any>) => unknown) {
      const sent: Record<string, any>[] = []
      const get_client = () => ({
        client: {
          send: (command: { input: Record<string, any> }) => {
            sent.push(command.input)
            const answer = respond(command.input)
            return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
          },
        },
        bucket: 'livingdictionaries-og-cache',
      })
      return { sent, transport: create_r2_transport({ get_client: get_client as unknown as typeof get_r2_og_cache }) }
    }

    const { signal } = new AbortController()

    test('a GET asks the right bucket + key and returns the bytes', async () => {
      const { sent, transport } = fake_client(() => ({ Body: { transformToByteArray: () => Promise.resolve(PNG) } }))
      expect(await transport.get_object({ key: 'abc', signal })).toEqual(PNG)
      expect(sent[0]).toMatchObject({ Bucket: 'livingdictionaries-og-cache', Key: 'cards/abc.png' })
    })

    test('an absent key, and a bucket that does not exist YET, are both a plain null', async () => {
      const missing = fake_client(() => Object.assign(new Error('no key'), { name: 'NoSuchKey' }))
      expect(await missing.transport.get_object({ key: 'abc', signal })).toBe(null)

      const no_bucket = fake_client(() => Object.assign(new Error('no bucket'), { name: 'NoSuchBucket' }))
      expect(await no_bucket.transport.get_object({ key: 'abc', signal })).toBe(null)

      const four_oh_four = fake_client(() => Object.assign(new Error('404'), { $metadata: { httpStatusCode: 404 } }))
      expect(await four_oh_four.transport.get_object({ key: 'abc', signal })).toBe(null)
    })

    test('a REAL fault still throws, so the store can count it against the breaker', async () => {
      const { transport } = fake_client(() => Object.assign(new Error('slow down'), { $metadata: { httpStatusCode: 503 } }))
      await expect(transport.get_object({ key: 'abc', signal })).rejects.toThrow('slow down')
    })

    test('a PUT stores an immutable image/png under the same key', async () => {
      const { sent, transport } = fake_client(() => ({}))
      await transport.put_object({ key: 'abc', png: PNG, signal })
      expect(sent[0]).toMatchObject({
        Bucket: 'livingdictionaries-og-cache',
        Key: 'cards/abc.png',
        ContentType: 'image/png',
        CacheControl: 'public, immutable, max-age=31536000',
      })
    })
  })
}
