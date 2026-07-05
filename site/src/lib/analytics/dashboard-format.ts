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

const PERF_LABELS: Record<string, string> = { page_load: 'Page load', search: 'Search', web_vital: 'Web vital', viewer_boot: 'Viewer boot' }
export function perf_label(name: string): string {
  return PERF_LABELS[name] ?? name
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

/** Build ids are long timestamps; show a short trailing slice for readability. */
export function short_version(version: string | null): string {
  if (!version)
    return 'unknown'
  return version.length > 10 ? `…${version.slice(-8)}` : version
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
