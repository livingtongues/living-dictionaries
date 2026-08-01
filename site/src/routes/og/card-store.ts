import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { RemoteCardStore } from './card-store-remote'
import { remote_card_store } from './card-store-remote'
import { record_og_event } from './og-telemetry'

/**
 * Render each share card ONCE, then serve it from disk — with R2 behind the disk
 * as the tier that actually HOLDS the card space.
 *
 * WHY (2026-07-27 review + `.issues/og-endpoint-load-outages.md`): `/og` rendered
 * a 1200×630 PNG **per request**, synchronously, on the single Node thread —
 * ~700–840 ms each, and crawlers re-request the same cards in five-minute bursts.
 * Eight concurrent renders stretched to 5.0–5.7 s each and pushed `/healthz` to
 * 3,251 ms against Caddy's 2 s health timeout: Caddy marked BOTH containers down
 * and refused 1,553 requests across five outages in one evening, with 21
 * signed-in users' edits failing to sync. The only in-process cache was an
 * unbounded `Map` that also leaked every PNG for the life of the process
 * (2.87 GiB serving vs 1.17 GiB idle standby).
 *
 * Jacob's standing rule: *the question is never "is it fast enough", it is
 * "whose request pays for it."* For a share card the answer is nobody's — it was
 * rendered once and stored.
 *
 * Deliberately dumb + fail-open: any
 * unreadable/corrupt file reads as a miss (we just render again), and a failed
 * write never breaks the response that already has a perfectly good PNG in hand.
 * Writes are atomic (temp + rename) so the blue and green containers can share
 * one `DATA_DIR` — a card rendered by one is free for the other.
 *
 * Cards are keyed by the exact request that produced them, and `/og` responses
 * are already served `immutable, max-age=31536000`, so a stored card is exactly
 * as fresh as the URL contract already promises. Bump `SeoMetaTags`'
 * `OG_IMAGE_VERSION` (which travels as `?v=`) to invalidate everything.
 *
 * WHY DISK IS ONLY A CACHE (2026-07-30, `.issues/og-card-store-on-r2.md`): the
 * card space is 1,291 dictionaries + 589,990 entries ≈ 104 GB against 76 GB of
 * free disk. There is no cap that makes disk hold it, and the 1,000-entry cap it
 * ran with meant 18,174 renders/day for 1,000 slots while 55% of `/og` requests
 * were shed to the generic card. The durable tier is R2
 * (`card-store-remote.ts`); disk is the ~15 ms hot tier in front of it and the
 * one tier that keeps serving during an R2 outage.
 */

/**
 * Bumped when the stored BYTES' meaning changes (a card redesign, a new size).
 *
 * | v | why |
 * |---|-----|
 * | 1 | initial |
 * | 2 | 2026-07-31 — the satori 0.0.44 → 0.29 upgrade. `OG_IMAGE_VERSION` alone would not have been enough: it only changes the URLs new markup emits, and a scraper re-fetching the `?v=6` URL it already holds would keep being served the stored generic/tofu card forever. |
 */
const STORE_FORMAT = 2

/**
 * The hot tier's size — a LATENCY knob now, never again the thing that decides
 * whether we re-render (Jacob, 2026-07-30). ~173 KB per card, so ~5,000 cards is
 * about 1 GB: 1.3% of free disk for the whole popular head of the card space,
 * with everything past it one R2 GET away instead of one 450 ms render away.
 */
const MAX_ENTRIES = 5000
const MAX_BYTES = 1_000_000_000
/** Amortize the O(n) prune: one readdir per this many saves, never on the hot path. */
const PRUNE_EVERY_SAVES = 25
/** Approximate LRU without a metadata write per hit. */
const TOUCH_AFTER_MS = 24 * 60 * 60 * 1000

/**
 * The R2 tier, swappable so the store's own tests can drive a hit, a fault and a
 * back-fill without a bucket. Production never calls the setter.
 */
let remote: RemoteCardStore = remote_card_store

export function set_remote_card_store(store: RemoteCardStore): void {
  remote = store
}

/** Resolved per call, never captured: `DATA_DIR` can change after module init (tests). */
function store_dir(): string {
  return join(process.env.DATA_DIR || '.data', 'og-cache')
}

function file_path(key: string): string {
  return join(store_dir(), `${key}.png`)
}

/**
 * The card's identity: the whole encoded `props` param plus the `?v=` cache-buster
 * the markup already carries. Hashing the RAW param (not the decoded object) keeps
 * this exact and allocation-free — two requests with the same URL are the same card.
 */
export function card_key({ props_param, image_version }: {
  props_param: string | null
  image_version: string | null
}): string {
  return createHash('sha256')
    .update(`${STORE_FORMAT}|${image_version ?? ''}|${props_param ?? 'no-props'}`)
    .digest('hex')
    .slice(0, 32)
}

/**
 * The DISK tier only, synchronously.
 *
 * Kept sync and separate because the shed path (`degraded_response()`) must cost
 * a shed request nothing at all — no await, no network, no R2.
 */
export function read_local_card(key: string): Uint8Array | null {
  let png: Uint8Array
  try {
    png = readFileSync(file_path(key))
  } catch {
    return null // no file yet — a plain miss, not an error
  }
  touch_if_stale(key)
  return png
}

export interface StoredCard {
  png: Uint8Array
  source: 'disk' | 'r2'
}

/**
 * The card from whichever tier has it: disk, then R2, then nothing.
 *
 * An R2 hit BACK-FILLS the disk tier, so the popular head of the card space
 * settles onto local disk by itself and only the long tail pays a round trip.
 * Every R2 fault is a plain miss (see `card-store-remote.ts`), so the worst case
 * is exactly the old behaviour: we render.
 */
export async function read_stored_card(key: string): Promise<StoredCard | null> {
  const local = read_local_card(key)
  if (local)
    return { png: local, source: 'disk' }

  const remote_png = await remote.read(key)
  if (!remote_png)
    return null
  save_local_card({ key, png: remote_png })
  return { png: remote_png, source: 'r2' }
}

/** Store a card in BOTH tiers: disk now, R2 right after the response goes out. */
export function save_card({ key, png }: { key: string, png: Uint8Array }): void {
  save_local_card({ key, png })
  remote.write({ key, png })
}

function save_local_card({ key, png }: { key: string, png: Uint8Array }): void {
  try {
    const dir = store_dir()
    mkdirSync(dir, { recursive: true })
    // Same-directory temp + rename = atomic, so a crash (or the other container
    // reading concurrently) can never see a half-written PNG.
    const temp = join(dir, `.${key}.${process.pid}.tmp`)
    writeFileSync(temp, png)
    renameSync(temp, file_path(key))
  } catch {
    return // a card we already rendered is not worth failing a response over
  }
  saves_since_prune++
  if (saves_since_prune >= PRUNE_EVERY_SAVES) {
    saves_since_prune = 0
    // Off the request path — the response is already on its way out. The prune
    // result doubles as the store-state telemetry: resident entries/bytes +
    // evictions, coalesced, so cache pressure is a measured number instead of a
    // directory listing nobody takes.
    setTimeout(() => {
      const { removed, kept, bytes } = prune_card_store()
      record_og_event({
        level: 'info',
        message: 'og_store_state',
        context: { kept, bytes, removed, max_entries: MAX_ENTRIES, max_bytes: MAX_BYTES, ...remote_store_state() },
      })
    }, 0).unref?.()
  }
}

let saves_since_prune = 0

/**
 * The DURABLE tier's own numbers, folded into the same snapshot event.
 *
 * The R2 tier shipped counting `gets`/`puts`/`faults` internally and emitting
 * none of them, which made it unfalsifiable from telemetry: it is only READ on a
 * disk miss, so while the disk tier still has room, "working perfectly" and
 * "silently broken" both produce zero `og_card_served { source: 'r2' }` and zero
 * `og_remote_card_fault` (2026-07-31 overnight brief — the same gap house filed
 * and fixed the following night). Counters are cumulative per container since
 * boot; the event is a snapshot, so each flush reports the latest.
 */
export function remote_store_state(): Record<string, unknown> {
  try {
    const { configured, breaker_open, absent_keys, gets, puts, faults } = remote.stats()
    return { remote_configured: configured, remote_gets: gets, remote_puts: puts, remote_faults: faults, breaker_open, absent_keys }
  } catch {
    return {} // the disk half of the state is worth having even if the remote tier can't answer
  }
}

/** Bump mtime on a hit so the prune's oldest-first order approximates LRU. */
function touch_if_stale(key: string): void {
  try {
    const path = file_path(key)
    const { mtimeMs } = statSync(path)
    if (Date.now() - mtimeMs < TOUCH_AFTER_MS)
      return
    const now = new Date()
    utimesSync(path, now, now)
  } catch {
    // best effort only
  }
}

export interface PruneResult {
  removed: number
  kept: number
  bytes: number
}

/**
 * Enforce the entry + byte caps, oldest (least recently touched) first. Exported
 * for the tests and for anything that ever wants to reclaim disk on demand.
 */
export function prune_card_store(): PruneResult {
  const dir = store_dir()
  let entries: { path: string, mtime: number, size: number }[]
  try {
    entries = readdirSync(dir)
      .filter(name => name.endsWith('.png'))
      .map((name) => {
        const path = join(dir, name)
        const stat = statSync(path)
        return { path, mtime: stat.mtimeMs, size: stat.size }
      })
  } catch {
    return { removed: 0, kept: 0, bytes: 0 }
  }

  entries.sort((a, b) => b.mtime - a.mtime) // newest first — keep from the front
  let kept = 0
  let bytes = 0
  let removed = 0
  for (const entry of entries) {
    const would_be_bytes = bytes + entry.size
    if (kept < MAX_ENTRIES && would_be_bytes <= MAX_BYTES) {
      kept++
      bytes = would_be_bytes
      continue
    }
    try {
      unlinkSync(entry.path)
      removed++
    } catch {
      // raced with the other container's prune — fine
    }
  }
  return { removed, kept, bytes }
}

if (import.meta.vitest) {
  let data_dir: string
  let previous_data_dir: string | undefined

  beforeEach(() => {
    previous_data_dir = process.env.DATA_DIR
    data_dir = mkdtempSync(join(tmpdir(), 'ld-og-store-'))
    process.env.DATA_DIR = data_dir
  })
  afterEach(() => {
    if (previous_data_dir === undefined)
      delete process.env.DATA_DIR
    else
      process.env.DATA_DIR = previous_data_dir
    rmSync(data_dir, { recursive: true, force: true })
  })

  describe(card_key, () => {
    test('the same request is the same card', () => {
      expect(card_key({ props_param: 'abc', image_version: '6' })).toBe(card_key({ props_param: 'abc', image_version: '6' }))
    })
    test('different props, and a bumped OG_IMAGE_VERSION, are different cards', () => {
      expect(card_key({ props_param: 'abc', image_version: '6' })).not.toBe(card_key({ props_param: 'abd', image_version: '6' }))
      expect(card_key({ props_param: 'abc', image_version: '6' })).not.toBe(card_key({ props_param: 'abc', image_version: '7' }))
    })
    test('a missing props param still keys deterministically (the generic card)', () => {
      expect(card_key({ props_param: null, image_version: null })).toBe(card_key({ props_param: null, image_version: null }))
    })
    test('the key is filename-safe', () => {
      expect(card_key({ props_param: '../../etc/passwd', image_version: null })).toMatch(/^[0-9a-f]{32}$/)
    })
  })

  describe(read_local_card, () => {
    test('a miss is null, not a throw (an empty store is the normal cold state)', () => {
      expect(read_local_card('nothing-here')).toBe(null)
    })

    test('a saved card comes back byte-for-byte', () => {
      const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 1, 2, 3])
      save_card({ key: 'k1', png })
      expect(read_local_card('k1')).toEqual(png)
    })

    test('an unwritable DATA_DIR degrades to a miss instead of failing the response', () => {
      // A FILE where the directory should be — mkdir then fails with ENOTDIR.
      const not_a_dir = join(data_dir, 'data-dir-is-a-file')
      writeFileSync(not_a_dir, 'x')
      process.env.DATA_DIR = not_a_dir
      expect(() => save_card({ key: 'k2', png: Buffer.from([1]) })).not.toThrow()
      expect(read_local_card('k2')).toBe(null)
    })
  })

  describe(read_stored_card, () => {
    const REMOTE_PNG = Buffer.from([9, 9, 9])

    /** A remote tier that answers every read with `holds` (null = a miss/fault). */
    function stub_remote(holds: Uint8Array | null = null) {
      const reads: string[] = []
      const writes: string[] = []
      set_remote_card_store({
        read: (key) => {
          reads.push(key)
          return Promise.resolve(holds)
        },
        write: ({ key }) => {
          writes.push(key)
        },
        stats: () => ({ configured: true, breaker_open: false, consecutive_faults: 0, absent_keys: 0, gets: 0, puts: 0, faults: 0 }),
        reset: () => undefined,
      })
      return { reads, writes }
    }

    afterEach(() => set_remote_card_store(remote_card_store))

    test('a disk hit never touches R2', async () => {
      const { reads } = stub_remote()
      const png = Buffer.from([1, 2, 3])
      save_card({ key: 'hot', png })
      expect(await read_stored_card('hot')).toEqual({ png, source: 'disk' })
      expect(reads).toEqual([])
    })

    test('a disk miss served from R2 BACK-FILLS disk, so the next hit is local', async () => {
      const { reads } = stub_remote(REMOTE_PNG)
      expect(await read_stored_card('cold')).toEqual({ png: REMOTE_PNG, source: 'r2' })
      expect(reads).toEqual(['cold'])
      expect(read_local_card('cold')).toEqual(REMOTE_PNG)
      expect(await read_stored_card('cold')).toEqual({ png: REMOTE_PNG, source: 'disk' })
    })

    test('an R2 fault is a miss (the caller renders), never a throw', async () => {
      stub_remote(null)
      expect(await read_stored_card('gone')).toBe(null)
    })

    test('saving a card writes BOTH tiers', () => {
      const { writes } = stub_remote()
      save_card({ key: 'both', png: Buffer.from([4]) })
      expect(read_local_card('both')).toEqual(Buffer.from([4]))
      expect(writes).toEqual(['both'])
    })
  })

  describe(remote_store_state, () => {
    afterEach(() => set_remote_card_store(remote_card_store))

    test('reports the R2 tier\'s counters so a silently-broken tier stops looking identical to a healthy one', () => {
      set_remote_card_store({
        read: () => Promise.resolve(null),
        write: () => undefined,
        stats: () => ({ configured: true, breaker_open: true, consecutive_faults: 2, absent_keys: 7, gets: 12, puts: 3, faults: 5 }),
        reset: () => undefined,
      })
      expect(remote_store_state()).toEqual({
        remote_configured: true,
        remote_gets: 12,
        remote_puts: 3,
        remote_faults: 5,
        breaker_open: true,
        absent_keys: 7,
      })
    })

    test('a remote tier that cannot answer never breaks the snapshot', () => {
      set_remote_card_store({
        read: () => Promise.resolve(null),
        write: () => undefined,
        stats: () => { throw new Error('no client') },
        reset: () => undefined,
      })
      expect(remote_store_state()).toEqual({})
    })
  })

  describe(prune_card_store, () => {
    test('an empty/absent store prunes to nothing without throwing', () => {
      expect(prune_card_store()).toEqual({ removed: 0, kept: 0, bytes: 0 })
    })

    test('keeps the most recently touched and removes the rest once over the byte cap', () => {
      // 1 MB each, 300 of them would blow MAX_BYTES; simulate with a tiny cap by
      // writing enough bytes that the cap bites.
      const big = Buffer.alloc(1_000_000, 7)
      for (let i = 0; i < 3; i++)
        save_card({ key: `big-${i}`, png: big })
      const result = prune_card_store()
      // Well under both caps — nothing should be removed.
      expect(result.removed).toBe(0)
      expect(result.kept).toBe(3)
      expect(result.bytes).toBe(3_000_000)
    })

    test('removes the oldest when the entry cap is exceeded', () => {
      const png = Buffer.from([1, 2, 3])
      const old_time = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      for (let i = 0; i < MAX_ENTRIES + 5; i++)
        save_card({ key: `n${i}`, png })
      // Age the first five so they sort last and get evicted.
      for (let i = 0; i < 5; i++)
        utimesSync(join(data_dir, 'og-cache', `n${i}.png`), old_time, old_time)
      const result = prune_card_store()
      expect(result.removed).toBe(5)
      expect(result.kept).toBe(MAX_ENTRIES)
      expect(read_local_card('n0')).toBe(null)
      expect(read_local_card(`n${MAX_ENTRIES + 4}`)).toEqual(png)
    })
  })
}
