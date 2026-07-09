import { readdirSync, readFileSync, statfsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

/**
 * Whole-box (VPS host) resource readings from inside the app container.
 *
 * HOW THIS WORKS IN DOCKER: `/proc/meminfo`, `/proc/stat`, and `/proc/loadavg`
 * are NOT namespaced — a container sees the HOST's memory, CPU counters, and
 * load average (only cgroup limits are per-container, and we don't set any).
 * `statfs` on the bind-mounted data dir reports the host filesystem backing it.
 * So the app can report the health of the whole VPS with zero agents, no SSH,
 * and no extra containers — just a few microsecond file reads.
 *
 * CPU% SEMANTICS: `/proc/stat` counters are cumulative since boot, so the delta
 * between two reads is the TRUE average utilization over that window — nothing
 * between samples is missed. Each named tracker keeps its own baseline on
 * globalThis (the 5-min cron and ad-hoc page loads must not reset each other's
 * window). The first read of a tracker has no baseline → `cpu_pct: null`.
 *
 * Consumed two ways (see host-stats-cron.ts + log-analytics.ts):
 *   - a 5-min cron logs a `host_stats` server event → 14-day trend charts;
 *   - the /admin/health load reads a live snapshot for the "now" meters.
 *
 * Everything is defensive: on a platform without /proc (mac dev) every field
 * degrades to null instead of throwing.
 */

/** One host reading, pre-rounded for storage in a `host_stats` event context. */
export interface HostStats {
  /** Average whole-box CPU % since this tracker's previous read; null on the first read. */
  cpu_pct: number | null
  /** Seconds covered by `cpu_pct`'s averaging window. */
  cpu_window_s: number | null
  load1: number | null
  load5: number | null
  load15: number | null
  cores: number | null
  /** Used = MemTotal − MemAvailable (the kernel's own "really available" estimate). */
  mem_pct: number | null
  mem_used_mb: number | null
  mem_total_mb: number | null
  swap_pct: number | null
  swap_used_mb: number | null
  swap_total_mb: number | null
  /** Host filesystem backing the data dir (used / (used + available), like `df`). */
  disk_pct: number | null
  disk_used_gb: number | null
  disk_total_gb: number | null
  /** Recursive size of the app data dir (hourly-cached walk). */
  data_dir_mb: number | null
}

export interface CpuCounters { busy: number, total: number }

/** Parse the aggregate `cpu` line of /proc/stat into busy/total jiffy counters. */
export function parse_cpu_counters(text: string): CpuCounters | null {
  const line = text.split('\n').find(row => /^cpu\s/.test(row))
  if (!line)
    return null
  const fields = line.trim().split(/\s+/).slice(1).map(Number)
  if (fields.length < 4 || fields.some(Number.isNaN))
    return null
  const [, , , idle, iowait = 0] = fields
  const total = fields.reduce((sum, value) => sum + value, 0)
  return { busy: total - idle - iowait, total }
}

/** Count `cpu0..cpuN` lines in /proc/stat — the host's logical core count. */
export function count_cores(text: string): number | null {
  const count = text.split('\n').filter(row => /^cpu\d+\s/.test(row)).length
  return count > 0 ? count : null
}

/** Average CPU % across the window between two cumulative counter reads. */
export function cpu_pct_between(prev: CpuCounters, next: CpuCounters): number | null {
  const total = next.total - prev.total
  const busy = next.busy - prev.busy
  if (total <= 0)
    return null
  return round1(Math.min(100, Math.max(0, (busy / total) * 100)))
}

export function parse_loadavg(text: string): { load1: number, load5: number, load15: number } | null {
  const [load1, load5, load15] = text.trim().split(/\s+/).map(Number)
  if ([load1, load5, load15].some(value => value === undefined || Number.isNaN(value)))
    return null
  return { load1: round2(load1), load5: round2(load5), load15: round2(load15) }
}

export interface MemInfo { mem_total_kb: number, mem_available_kb: number, swap_total_kb: number, swap_free_kb: number }

export function parse_meminfo(text: string): MemInfo | null {
  const kb = (key: string): number | null => {
    const match = text.match(new RegExp(`^${key}:\\s+(\\d+) kB`, 'm'))
    return match ? Number(match[1]) : null
  }
  const mem_total_kb = kb('MemTotal')
  const mem_available_kb = kb('MemAvailable')
  const swap_total_kb = kb('SwapTotal')
  const swap_free_kb = kb('SwapFree')
  if (mem_total_kb === null || mem_available_kb === null)
    return null
  return { mem_total_kb, mem_available_kb, swap_total_kb: swap_total_kb ?? 0, swap_free_kb: swap_free_kb ?? 0 }
}

// --- globalThis state: per-tracker CPU baselines + the hourly data-dir cache.
// (Same singleton pattern as the crons — survives HMR/module re-imports.) ---

const CPU_STATE_KEY = Symbol.for('living.host-stats.cpu-baselines')
interface CpuBaseline { counters: CpuCounters, at_ms: number }
interface GlobalWithHostStats {
  [CPU_STATE_KEY]?: Map<string, CpuBaseline>
  [DATA_DIR_CACHE_KEY]?: { bytes: number | null, at_ms: number }
}
const DATA_DIR_CACHE_KEY = Symbol.for('living.host-stats.data-dir-cache')
const DATA_DIR_CACHE_MS = 60 * 60 * 1000 // the recursive walk is the only non-trivial read — hourly is plenty

function cpu_baselines(): Map<string, CpuBaseline> {
  const slot = globalThis as unknown as GlobalWithHostStats
  if (!slot[CPU_STATE_KEY])
    slot[CPU_STATE_KEY] = new Map()
  return slot[CPU_STATE_KEY]
}

function read_proc(file: string): string | null {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/**
 * Recursive byte size of the app data dir, cached for an hour. `du` equivalent;
 * runs hourly at most so a large `files/` tree can't tax the 5-min cron.
 */
export function data_dir_bytes({ dir = process.env.DATA_DIR || '.data', now_ms = Date.now() }: { dir?: string, now_ms?: number } = {}): number | null {
  const slot = globalThis as unknown as GlobalWithHostStats
  const cached = slot[DATA_DIR_CACHE_KEY]
  if (cached && now_ms - cached.at_ms < DATA_DIR_CACHE_MS)
    return cached.bytes
  let bytes: number | null
  try {
    let total = 0
    for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile())
        continue
      try {
        total += statSync(join(entry.parentPath, entry.name)).size
      } catch {
        // File vanished mid-walk (WAL churn) — skip.
      }
    }
    bytes = total
  } catch {
    bytes = null // data dir missing (fresh dev checkout) — report unknown
  }
  slot[DATA_DIR_CACHE_KEY] = { bytes, at_ms: now_ms }
  return bytes
}

/**
 * Read a full host snapshot. `tracker` names the CPU baseline to diff against —
 * use a stable name per consumer ('cron', 'request') so concurrent consumers
 * don't shorten each other's averaging windows.
 */
export function read_host_stats({ tracker, data_dir, now_ms = Date.now(), proc_stat_text }: { tracker: string, data_dir?: string, now_ms?: number, /** Test-only: inject /proc/stat text so CPU deltas are deterministic. */ proc_stat_text?: string }): HostStats {
  const stat_text = proc_stat_text ?? read_proc('/proc/stat')
  const meminfo = parse_meminfo(read_proc('/proc/meminfo') ?? '')
  const loads = parse_loadavg(read_proc('/proc/loadavg') ?? '')

  let cpu_pct: number | null = null
  let cpu_window_s: number | null = null
  const counters = stat_text ? parse_cpu_counters(stat_text) : null
  if (counters) {
    const baselines = cpu_baselines()
    const prev = baselines.get(tracker)
    if (prev && now_ms > prev.at_ms) {
      cpu_pct = cpu_pct_between(prev.counters, counters)
      cpu_window_s = Math.round((now_ms - prev.at_ms) / 1000)
    }
    baselines.set(tracker, { counters, at_ms: now_ms })
  }

  let disk_pct: number | null = null
  let disk_used_gb: number | null = null
  let disk_total_gb: number | null = null
  try {
    const fs_stats = statfsSync(data_dir ?? (process.env.DATA_DIR || '.data'))
    const used = (fs_stats.blocks - fs_stats.bfree) * fs_stats.bsize
    const available = fs_stats.bavail * fs_stats.bsize
    disk_used_gb = round1(used / 1024 ** 3)
    disk_total_gb = round1((used + available) / 1024 ** 3)
    disk_pct = used + available > 0 ? round1((used / (used + available)) * 100) : null
  } catch {
    // No such path (fresh dev) — leave disk unknown.
  }

  const swap_used_kb = meminfo ? meminfo.swap_total_kb - meminfo.swap_free_kb : null
  const data_bytes = data_dir_bytes({ ...(data_dir ? { dir: data_dir } : {}), now_ms })

  return {
    cpu_pct,
    cpu_window_s,
    load1: loads?.load1 ?? null,
    load5: loads?.load5 ?? null,
    load15: loads?.load15 ?? null,
    cores: stat_text ? count_cores(stat_text) : null,
    mem_pct: meminfo ? round1(((meminfo.mem_total_kb - meminfo.mem_available_kb) / meminfo.mem_total_kb) * 100) : null,
    mem_used_mb: meminfo ? Math.round((meminfo.mem_total_kb - meminfo.mem_available_kb) / 1024) : null,
    mem_total_mb: meminfo ? Math.round(meminfo.mem_total_kb / 1024) : null,
    swap_pct: meminfo && meminfo.swap_total_kb > 0 ? round1(((swap_used_kb as number) / meminfo.swap_total_kb) * 100) : null,
    swap_used_mb: swap_used_kb !== null ? Math.round(swap_used_kb / 1024) : null,
    swap_total_mb: meminfo ? Math.round(meminfo.swap_total_kb / 1024) : null,
    disk_pct,
    disk_used_gb,
    disk_total_gb,
    data_dir_mb: data_bytes !== null ? Math.round(data_bytes / 1024 ** 2) : null,
  }
}

/** Test-only: clear CPU baselines + the data-dir cache between tests. */
export function _reset_host_stats_state(): void {
  const slot = globalThis as unknown as GlobalWithHostStats
  delete slot[CPU_STATE_KEY]
  delete slot[DATA_DIR_CACHE_KEY]
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

if (import.meta.vitest) {
  const PROC_STAT = [
    'cpu  1000 50 500 8000 200 10 40 0 0 0',
    'cpu0 500 25 250 4000 100 5 20 0 0 0',
    'cpu1 500 25 250 4000 100 5 20 0 0 0',
    'intr 12345',
  ].join('\n')

  describe(parse_cpu_counters, () => {
    test('sums jiffies and separates busy from idle+iowait', () => {
      const counters = parse_cpu_counters(PROC_STAT)
      expect(counters).toEqual({ busy: 1600, total: 9800 })
    })
    test('null on garbage', () => {
      expect(parse_cpu_counters('not proc stat')).toBeNull()
    })
  })

  describe(count_cores, () => {
    test('counts cpuN lines', () => {
      expect(count_cores(PROC_STAT)).toBe(2)
    })
    test('null when no per-core lines', () => {
      expect(count_cores('cpu  1 2 3 4')).toBeNull()
    })
  })

  describe(cpu_pct_between, () => {
    test('averages busy share across the window', () => {
      // +300 busy over +1000 total → 30%
      expect(cpu_pct_between({ busy: 1600, total: 9800 }, { busy: 1900, total: 10_800 })).toBe(30)
    })
    test('null when the window is empty (same read twice)', () => {
      expect(cpu_pct_between({ busy: 5, total: 10 }, { busy: 5, total: 10 })).toBeNull()
    })
    test('clamps rounding artifacts into 0..100', () => {
      expect(cpu_pct_between({ busy: 0, total: 0 }, { busy: 2000, total: 1000 })).toBe(100)
    })
  })

  describe(parse_loadavg, () => {
    test('parses the three load averages', () => {
      expect(parse_loadavg('0.52 0.58 0.59 1/467 12345\n')).toEqual({ load1: 0.52, load5: 0.58, load15: 0.59 })
    })
    test('null on garbage', () => {
      expect(parse_loadavg('')).toBeNull()
    })
  })

  describe(parse_meminfo, () => {
    const MEMINFO = [
      'MemTotal:        3915776 kB',
      'MemFree:          313216 kB',
      'MemAvailable:    2260992 kB',
      'SwapTotal:       2097148 kB',
      'SwapFree:        2097148 kB',
    ].join('\n')
    test('extracts totals and available', () => {
      expect(parse_meminfo(MEMINFO)).toEqual({
        mem_total_kb: 3_915_776,
        mem_available_kb: 2_260_992,
        swap_total_kb: 2_097_148,
        swap_free_kb: 2_097_148,
      })
    })
    test('null when MemAvailable missing', () => {
      expect(parse_meminfo('MemTotal: 1000 kB')).toBeNull()
    })
  })

  describe(read_host_stats, () => {
    const STAT_EARLY = PROC_STAT
    const STAT_LATER = PROC_STAT.replace(/^cpu\s.*/m, 'cpu  1300 50 500 8200 200 10 40 0 0 0')

    test('first read has no CPU baseline; the second reports a window', () => {
      _reset_host_stats_state()
      const first = read_host_stats({ tracker: 'test', now_ms: 1000, proc_stat_text: STAT_EARLY })
      const second = read_host_stats({ tracker: 'test', now_ms: 61_000, proc_stat_text: STAT_LATER })
      expect(first.cpu_pct).toBeNull()
      expect(second.cpu_window_s).toBe(60)
      expect(second.cpu_pct).not.toBeNull()
      _reset_host_stats_state()
    })

    test('separate trackers keep independent baselines', () => {
      _reset_host_stats_state()
      read_host_stats({ tracker: 'a', now_ms: 1000 })
      const other = read_host_stats({ tracker: 'b', now_ms: 2000 })
      expect(other.cpu_pct).toBeNull() // b has never read before — a's baseline must not leak
      _reset_host_stats_state()
    })
  })
}
