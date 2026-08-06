import type Database from 'better-sqlite3'
import { env } from '$env/dynamic/private'
import { ROOM_NOTIFICATIONS } from '$lib/chat/constants'
import { deliver_system_message } from '$lib/server/chat/system-message'
import { log_server_event } from '$lib/server/log-server-event'
import { get_shared_db } from './shared-db'
import type { MonthlyMetrics } from './monthly-metrics'
import { is_partial_capture, NORMALIZED_MONTH_DAYS, normalized_site_visitors } from './monthly-metrics'

/**
 * Once a month, post a short human summary of the frozen `monthly_metrics` row
 * into the admin chat `notifications` room.
 *
 * Jacob's shape (2026-08-01): "just a few simple lines of text, formatted to
 * make it a little bit easier to parse — just a few of the basic stats. Next
 * month it will have percentage change." So: no chart link yet (a chart with one
 * data point is boring — that arrives once there are >=2 months), and deltas
 * appear only once a previous month exists to compare against.
 *
 * WHY THE PARENT AND NOT THE ANALYTICS CHILD posts it: pings need SES/ntfy,
 * which only exist inside the SvelteKit runtime. The child computes + stores the
 * row; `after_sweep` in the cron roster calls this afterwards, in-process.
 * Idempotent via `monthly_metrics.announced_at` — never posts a month twice.
 */

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function month_label(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  return `${MONTH_NAMES[mon - 1]} ${year}`
}

const n = (value: number): string => value.toLocaleString('en-US')
const pct = (part: number, whole: number): number => whole > 0 ? Math.round(100 * part / whole) : 0

/** Signed percent change, or null when there is nothing to compare against. */
function delta(current: number, previous: number | null): string | null {
  if (previous === null || previous <= 0) return null
  const change = Math.round(100 * (current - previous) / previous)
  if (change === 0) return 'flat'
  return `${change > 0 ? '+' : ''}${change}%`
}

const with_delta = (text: string, change: string | null): string => change ? `${text} (${change})` : text

/**
 * Build the summary lines. Pure — no db, no IO — so the wording is unit-testable.
 * `previous` is the prior month's row when one exists.
 */
export function build_monthly_summary({ metrics, previous }: {
  metrics: MonthlyMetrics
  previous?: MonthlyMetrics | null
}): { text: string, html: string } {
  const visitors = normalized_site_visitors(metrics)
  const previous_visitors = previous ? normalized_site_visitors(previous) : null
  const entries = metrics.mission_entries_created
  const attributed = metrics.mission_entries_agent + metrics.mission_entries_hand
  const dictionary_readers = metrics.mission_visitors + metrics.fenced_visitors

  const lines: string[] = [
    `${month_label(metrics.month)} stats`,
    with_delta(`Visitors: ~${n(visitors)}/month · ${pct(metrics.site_anon_visitors, metrics.site_visitors)}% not signed in`, delta(visitors, previous_visitors)),
    `Public and unlisted dictionaries: ${pct(metrics.mission_visitors, dictionary_readers)}% of readers`,
    with_delta(
      `Entries added: ${n(entries)} — ${pct(metrics.mission_entries_agent, attributed)}% by agent, ${pct(metrics.mission_entries_hand, attributed)}% by hand`,
      delta(entries, previous ? previous.mission_entries_created : null),
    ),
  ]

  // Corpus over the SAME grouping as the readership line above — comparing a
  // public+unlisted percentage against a public-only corpus was two different
  // denominators in one message (Jacob, 2026-08-01). Skipped entirely when the
  // row predates the columns rather than printing a wrong or partial number.
  if (metrics.mission_dictionaries !== null && metrics.mission_entries !== null) {
    lines.push(`Public and unlisted corpus: ${n(metrics.mission_dictionaries)} dictionaries · ${n(metrics.mission_entries)} entries`)
  }

  if (is_partial_capture(metrics)) {
    lines.push(`(${metrics.days_counted} days of clean capture, ${metrics.window_start} → ${metrics.window_end}, scaled to ${NORMALIZED_MONTH_DAYS} days)`)
  }

  const text = lines.join('\n')
  const [heading, ...rest] = lines
  const html = `<p><strong>${escape_html(heading)}</strong></p><p>${rest.map(escape_html).join('<br />')}</p>`
  return { text, html }
}

function escape_html(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Post the summary for any frozen month that has not been announced yet, oldest
 * first. Returns the months announced. Safe to call on every sweep.
 */
export async function announce_monthly_metrics({ shared_db, base_url }: {
  shared_db: Database.Database
  base_url: string
}): Promise<string[]> {
  const pending = shared_db.prepare('SELECT * FROM monthly_metrics WHERE announced_at IS NULL ORDER BY month').all() as MonthlyMetrics[]
  const announced: string[] = []
  for (const metrics of pending) {
    const previous = shared_db.prepare('SELECT * FROM monthly_metrics WHERE month = ?')
      .get(previous_month(metrics.month)) as MonthlyMetrics | undefined
    const { text, html } = build_monthly_summary({ metrics, previous: previous ?? null })
    await deliver_system_message({ db: shared_db, room_id: ROOM_NOTIFICATIONS, body_html: html, body_text: text, base_url })
    shared_db.prepare('UPDATE monthly_metrics SET announced_at = ? WHERE month = ?').run(new Date().toISOString(), metrics.month)
    announced.push(metrics.month)
  }
  return announced
}

function previous_month(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  return new Date(Date.UTC(year, mon - 2, 1)).toISOString().slice(0, 7)
}

/** Deep-link base for the cron (no request context). Tracks the deployed domain via ORIGIN. */
const SITE_URL = env.ORIGIN || 'https://new.livingdictionaries.app'

/**
 * The roster's after-sweep hook. Never throws — a failed announcement must not
 * take the retention sweep down with it, and the `announced_at` stamp means the
 * next sweep simply retries.
 */
export async function run_monthly_metrics_announcement(): Promise<void> {
  try {
    const announced = await announce_monthly_metrics({ shared_db: get_shared_db(), base_url: SITE_URL })
    if (announced.length)
      console.info(`[monthly-metrics] announced ${announced.join(', ')}.`)
  } catch (error) {
    console.error('[monthly-metrics] announcement failed:', error)
    log_server_event({ level: 'error', message: 'monthly_metrics_announce_failed', error })
  }
}

if (import.meta.vitest) {
  const base: MonthlyMetrics = {
    month: '2026-07',
    window_start: '2026-07-08',
    window_end: '2026-07-31',
    days_counted: 24,
    site_visitors: 5182,
    site_visits: 12320,
    site_anon_visitors: 5012,
    new_visitor_rate: 5182 / 24,
    mission_visitors: 4048,
    mission_visits: 8761,
    mission_anon_visitors: 3940,
    fenced_visitors: 365,
    public_dictionaries: 221,
    public_entries: 273581,
    mission_dictionaries: 621,
    mission_entries: 506615,
    platform_dictionaries: 1296,
    platform_entries: 590091,
    mission_entries_created: 28652,
    mission_entries_agent: 26553,
    mission_entries_hand: 1932,
    mission_entries_unattributed: 167,
    fenced_entries_created: 1407,
    computed_at: '2026-08-01T10:40:00.000Z',
    announced_at: null,
  }

  describe(build_monthly_summary, () => {
    it('reproduces the validated July baseline, with the partial-capture note', () => {
      const { text } = build_monthly_summary({ metrics: base, previous: null })
      expect(text).toBe([
        'July 2026 stats',
        'Visitors: ~6,693/month · 97% not signed in',
        'Public and unlisted dictionaries: 92% of readers',
        'Entries added: 28,652 — 93% by agent, 7% by hand',
        'Public and unlisted corpus: 621 dictionaries · 506,615 entries',
        '(24 days of clean capture, 2026-07-08 → 2026-07-31, scaled to 31 days)',
      ].join('\n'))
    })

    it('omits the corpus line rather than printing a wrong number when the row predates the columns', () => {
      const { text } = build_monthly_summary({ metrics: { ...base, mission_dictionaries: null, mission_entries: null }, previous: null })
      expect(text).not.toContain('corpus')
      expect(text).toContain('Entries added: 28,652')
    })

    it('omits deltas when there is no previous month (July has nothing to compare to)', () => {
      const { text } = build_monthly_summary({ metrics: base, previous: null })
      expect(text.includes('%)')).toBe(false)
    })

    it('adds percentage change once a previous month exists', () => {
      const august: MonthlyMetrics = {
        ...base,
        month: '2026-08',
        window_start: '2026-08-01',
        window_end: '2026-08-31',
        days_counted: 31,
        site_visitors: 8000,
        site_anon_visitors: 7760,
        new_visitor_rate: 8000 / 31,
        mission_entries_created: 14326,
      }
      const { text } = build_monthly_summary({ metrics: august, previous: base })
      expect(text).toContain('Visitors: ~8,000/month · 97% not signed in (+20%)')
      expect(text).toContain('Entries added: 14,326 — 93% by agent, 7% by hand (-50%)')
    })

    it('drops the capture note for a month measured in full', () => {
      const august: MonthlyMetrics = { ...base, month: '2026-08', window_start: '2026-08-01', window_end: '2026-08-31', days_counted: 31 }
      expect(build_monthly_summary({ metrics: august, previous: null }).text).not.toContain('clean capture')
    })
  })
}
