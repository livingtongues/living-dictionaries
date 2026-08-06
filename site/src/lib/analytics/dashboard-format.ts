/**
 * Pure formatting helpers + categorical palettes shared by the two admin telemetry
 * dashboards — `/admin/analytics` (usage) and `/admin/health` (diagnostics). Kept
 * here so the split pages (and their stories) don't each re-declare them.
 */

/** Cyan companion to `--primary` for the second series in two-line charts. */
export const USERS_COLOR = '#06b6d4'

export function format_ms(ms: number | null): string {
  if (ms == null)
    return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s` : `${Math.round(ms)}ms`
}

const PERF_LABELS: Record<string, string> = { page_load: 'Page load', navigation: 'Navigation', search: 'Search', web_vital: 'Web vital', viewer_boot: 'Viewer boot', dict_boot: 'Dictionary open' }
export function perf_label(name: string): string {
  return PERF_LABELS[name] ?? name
}

/**
 * Percentiles from fewer samples than this are anecdotes, not trends — one cold
 * outlier in n=9 once read as a "p90 = 7.8s regression" (2026-07-10 review,
 * ported from tutor). Views dim + asterisk such rows.
 */
export const THIN_SAMPLE_N = 15
export function is_thin_sample(count: number | null | undefined): boolean {
  return (count ?? 0) < THIN_SAMPLE_N
}

/** Relative "…m/h/d ago" from an ISO instant, or `never` when null. */
export function ago(iso: string | null): string {
  if (!iso)
    return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms))
    return 'never'
  const mins = Math.round(ms / 60000)
  if (mins < 1)
    return 'just now'
  if (mins < 60)
    return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48)
    return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** `YYYY-MM-DDTHH:MM:SS…` → `YYYY-MM-DD HH:MM`. */
export function short_time(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16)
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function short_day(day: string): string {
  const [, month, date] = day.split('-').map(Number)
  return `${MONTH_NAMES[(month || 1) - 1]} ${date}`
}

export function one_decimal(value: number | null): string {
  return value == null ? '—' : value.toFixed(1)
}

/** Human-readable file size (matches tutor's storage strip). */
export function format_bytes(bytes: number | null): string {
  if (bytes == null)
    return '—'
  if (bytes >= 1024 ** 3)
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2)
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes >= 1024)
    return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

/**
 * The commit sha inside a build `version` string, or null if the name carries
 * none. THE one place that knows the shape of a build name — every reader goes
 * through here, because the 2026-08-04 stamp change broke precisely by having
 * each reader carry its own private assumption about that shape.
 *
 * Three shapes are live at once:
 *   - `b4b47e55…`                 a bare 40-hex commit sha (2026-08-04 → 08-06);
 *   - `b4b47e55…-20260805144153`  commit + a per-build id (since 2026-08-06, so
 *                                 two builds of ONE commit stop colliding — see
 *                                 `resolve_version_name()` in svelte.config.js);
 *   - `1783526000580`             a bare clock reading, every build before
 *                                 2026-08-04 and still inside the 30-day window.
 */
export function commit_sha_of_build(version: string | null): string | null {
  if (!version)
    return null
  const match = /^([0-9a-f]{7,40})(?:-[0-9a-z]+)?$/i.exec(version)
  // A clock reading is all digits, and all digits are also valid hex.
  if (!match || /^\d+$/.test(match[1]))
    return null
  return match[1].toLowerCase()
}

/**
 * Build ids are long; show a short slice for readability.
 *
 * A commit shortens the way git shortens it — leading 7 — so it pastes straight
 * into `git show`. A compound `<sha>-<build id>` name keeps BOTH halves visible:
 * the previous version of this function fell through to a trailing slice for
 * anything that was not exactly 40 hex, so it would have rendered a piece of the
 * BUILD ID as though it were the commit. Not a crash — a label that quietly
 * stops meaning what it says.
 */
export function short_version(version: string | null): string {
  if (!version)
    return 'unknown'
  const sha = commit_sha_of_build(version)
  if (sha) {
    const build_id = version.slice(sha.length + 1)
    return build_id ? `${sha.slice(0, 7)}·${build_id.slice(-6)}` : sha.slice(0, 7)
  }
  return version.length > 10 ? `…${version.slice(-8)}` : version
}

if (import.meta.vitest) {
  describe(commit_sha_of_build, () => {
    it('reads a bare commit sha', () => {
      expect(commit_sha_of_build('b4b47e55ac6c866e5c9bcb91d7ea18234d5642e2')).toBe('b4b47e55ac6c866e5c9bcb91d7ea18234d5642e2')
    })
    it('reads the commit half of the compound `<sha>-<build id>` name', () => {
      expect(commit_sha_of_build('b4b47e55ac6c866e5c9bcb91d7ea18234d5642e2-20260805144153')).toBe('b4b47e55ac6c866e5c9bcb91d7ea18234d5642e2')
    })
    it('refuses a bare clock reading, which is also valid hex', () => {
      expect(commit_sha_of_build('1783526000580')).toBeNull()
    })
    it('refuses nothing, and a dev-session name', () => {
      expect(commit_sha_of_build(null)).toBeNull()
      expect(commit_sha_of_build('local-1783526000580')).toBeNull()
    })
  })

  describe(short_version, () => {
    it('shortens a commit the way git does, so it pastes into `git show`', () => {
      expect(short_version('b4b47e55ac6c866e5c9bcb91d7ea18234d5642e2')).toBe('b4b47e5')
    })
    it('keeps BOTH halves of a compound name rather than slicing it into a fake commit', () => {
      // The trap this closes: the old trailing-slice fallback took anything that
      // was not exactly 40 hex and showed its last 8 characters — which for a
      // compound name is a piece of the BUILD ID, reading as a commit.
      expect(short_version('b4b47e55ac6c866e5c9bcb91d7ea18234d5642e2-20260805144153')).toBe('b4b47e5·144153')
    })
    it('keeps the varying tail of a legacy clock name', () => {
      expect(short_version('1783526000580')).toBe('…26000580')
    })
    it('says so when there is no build', () => {
      expect(short_version(null)).toBe('unknown')
    })
  })
}

/** Country code → flag emoji (regional-indicator pair). Non-ISO sentinels (XX/T1) fall back to a globe. */
export function country_flag(code: string): string {
  if (!/^[A-Z]{2}$/i.test(code) || code.toUpperCase() === 'XX')
    return '🌐'
  return String.fromCodePoint(...[...code.toUpperCase()].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65))
}

// LD's best tier is `opfs-worker` (green); `idb-main` is the fallback (amber).
export function db_tier_color(tier: string): string {
  if (tier.startsWith('opfs'))
    return '#10b981'
  if (tier.startsWith('idb'))
    return '#f59e0b'
  return '#94a3b8'
}

export const DEVICE_META: Record<string, { label: string, color: string, icon?: string }> = {
  desktop: { label: 'Desktop', color: '#7c3aed', icon: '🖥️' },
  mobile: { label: 'Mobile', color: '#06b6d4', icon: '📱' },
  tablet: { label: 'Tablet', color: '#f59e0b' },
}
export const OS_COLORS: Record<string, string> = {
  Windows: '#7c3aed', macOS: '#10b981', iOS: '#f59e0b', iPadOS: '#8b5cf6',
  Android: '#06b6d4', ChromeOS: '#ec4899', Linux: '#64748b', Other: '#94a3b8',
}
export const BROWSER_COLORS: Record<string, string> = {
  'Chrome': '#7c3aed', 'Safari': '#06b6d4', 'Edge': '#10b981', 'Firefox': '#f59e0b',
  'Samsung Internet': '#ec4899', 'Opera': '#ef4444', 'Other': '#94a3b8',
}
