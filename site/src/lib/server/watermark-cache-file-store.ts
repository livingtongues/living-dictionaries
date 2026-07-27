import type { WatermarkSwrPersistence } from './watermark-swr-cache'
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Durable backing for a `WatermarkSwrCache`: one JSON file per key under
 * `DATA_DIR`, so an expensive payload survives a container restart.
 *
 * WHY (2026-07-26, found in house and ported here): house's `/admin/analytics`
 * compute measured 27–33 s cold on production and house deployed five times
 * that day — every deploy emptied the in-memory cache and handed the bill to
 * whoever opened the dashboard next. LD deploys several times a day, so "cold"
 * is its normal state — its own computes measured 11–80 s (2026-07-26 review).
 * Jacob's call was "it's ok to be a little stale": a restart now paints the last
 * computed numbers immediately and refreshes behind them.
 *
 * Deliberately dumb + fail-open: any unreadable/incompatible/corrupt file reads
 * as a miss (the caller just recomputes), and a failed write never breaks the
 * request that produced a perfectly good in-memory value. Writes are atomic
 * (temp file + rename) so a crash mid-write can't leave a half-parsed payload,
 * and both blue/green containers may write the same file safely.
 */

interface StoredEntry<T> {
  /** Bumped when a cached payload's SHAPE changes — old files then read as a miss. */
  format: number
  watermark: string | null
  /** When this file was written; surfaced for debugging, not used for freshness. */
  saved_at: string
  value: T
}

export function create_watermark_cache_file_store<T>({ dir, format_version }: {
  /** Resolved per call, never captured: `DATA_DIR` can change after module init (tests). */
  dir: () => string
  format_version: number
}): WatermarkSwrPersistence<T> {
  return {
    load(key) {
      let raw: string
      try {
        raw = readFileSync(file_path({ dir: dir(), key }), 'utf8')
      } catch {
        return null // no file yet — a plain miss, not an error
      }
      const parsed = JSON.parse(raw) as StoredEntry<T>
      if (!parsed || parsed.format !== format_version || !('value' in parsed))
        return null
      return { watermark: parsed.watermark ?? null, value: parsed.value }
    },
    save(key, entry) {
      const path = file_path({ dir: dir(), key })
      mkdirSync(dirname(path), { recursive: true })
      const stored: StoredEntry<T> = {
        format: format_version,
        watermark: entry.watermark,
        saved_at: new Date().toISOString(),
        value: entry.value,
      }
      // Unique temp name: the two blue/green containers share DATA_DIR and can
      // write the same key concurrently — each renames its own complete file.
      const temp = `${path}.${process.pid}.${Date.now()}.tmp`
      writeFileSync(temp, JSON.stringify(stored))
      renameSync(temp, path)
    },
    remove(key) {
      // `force` → a missing file is already the desired state.
      rmSync(file_path({ dir: dir(), key }), { force: true })
    },
  }
}

/**
 * `usage_primary:30:humans` → `<dir>/usage_primary-30-humans.json`.
 * Only word characters and hyphens survive, so a key can never contain a path
 * separator or a `..` segment and the file can never escape `dir`.
 */
function file_path({ dir, key }: { dir: string, key: string }): string {
  return join(dir, `${key.replace(/[^\w-]+/g, '-')}.json`)
}

if (import.meta.vitest) {
  describe(create_watermark_cache_file_store, () => {
    function temp_dir(): string {
      return mkdtempSync(join(tmpdir(), 'wm-cache-'))
    }

    it('round-trips a saved entry', () => {
      const dir = temp_dir()
      const store = create_watermark_cache_file_store<{ n: number }>({ dir: () => dir, format_version: 1 })
      store.save('usage_primary:30:humans', { watermark: '2026-07-25', value: { n: 7 } })
      expect(store.load('usage_primary:30:humans')).toEqual({ watermark: '2026-07-25', value: { n: 7 } })
      rmSync(dir, { recursive: true, force: true })
    })

    it('reads a missing file as a miss', () => {
      const dir = temp_dir()
      const store = create_watermark_cache_file_store({ dir: () => dir, format_version: 1 })
      expect(store.load('nothing-here')).toBe(null)
      rmSync(dir, { recursive: true, force: true })
    })

    it('reads a file written by a different payload format as a miss', () => {
      const dir = temp_dir()
      const old_store = create_watermark_cache_file_store<{ n: number }>({ dir: () => dir, format_version: 1 })
      old_store.save('k', { watermark: null, value: { n: 1 } })
      const new_store = create_watermark_cache_file_store<{ n: number }>({ dir: () => dir, format_version: 2 })
      expect(new_store.load('k')).toBe(null)
      rmSync(dir, { recursive: true, force: true })
    })

    it('keeps a null watermark null (a value computed before any rollup existed)', () => {
      const dir = temp_dir()
      const store = create_watermark_cache_file_store<string>({ dir: () => dir, format_version: 3 })
      store.save('k', { watermark: null, value: 'v' })
      expect(store.load('k')).toEqual({ watermark: null, value: 'v' })
      rmSync(dir, { recursive: true, force: true })
    })

    it('remove() invalidates a durable copy so a cleared cache cannot serve it back', () => {
      const dir = temp_dir()
      const store = create_watermark_cache_file_store<string>({ dir: () => dir, format_version: 1 })
      store.save('k', { watermark: 'day-1', value: 'v' })
      store.remove?.('k')
      expect(store.load('k')).toBe(null)
      // Removing a key that was never written is a no-op, not a throw.
      expect(() => store.remove?.('never-written')).not.toThrow()
      rmSync(dir, { recursive: true, force: true })
    })

    it('sanitizes a key into a flat filename', () => {
      expect(file_path({ dir: '/tmp/x', key: 'usage_primary:30:humans' })).toBe('/tmp/x/usage_primary-30-humans.json')
      expect(file_path({ dir: '/tmp/x', key: '../../etc/passwd' })).toBe('/tmp/x/-etc-passwd.json')
    })
  })
}
