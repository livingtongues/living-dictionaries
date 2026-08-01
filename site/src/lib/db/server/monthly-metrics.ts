import type Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { DICTIONARY_OPENED } from '$lib/debug/log-events'
import { is_bot_user_agent } from '$lib/utils/bot-user-agent'
import SqliteDatabase from 'better-sqlite3'
import { classify_ua_frequency_bot_sessions } from './bot-sessions'
import { dictionary_db_path } from './dictionary-db'
import { history_db_path } from './dictionary-history-db'
import { SESSION_START } from './log-retention-cron'

/**
 * ONE FROZEN ROW PER MONTH of the numbers we actually report — audience reach,
 * its mission/conlang split, and corpus production split by agent vs hand.
 *
 * WHY (2026-08-01, `.issues/monthly-metrics-baseline.md`): everything here is
 * derived from raw `client_logs` + per-dictionary history dbs, and raw logs
 * prune on a rolling 60 days. `dictionary_monthly_visitors` preserves only a
 * whole-month visitor union — not the mission/conlang split, not corpus
 * production, not the device-keyed window. So a month's real numbers become
 * unrecoverable ~60 days later unless they are frozen here. July 2026 is the
 * pre-surge baseline (big analytics/search + API changes are landing now);
 * losing it forfeits the starting line for measuring the surge.
 *
 * THE WINDOW IS THE HONESTY. A row stores what was measured over an explicit
 * window, never a pre-scaled "monthly total" — see `normalize_visitors`.
 *
 * COST: scans a month of raw logs plus every mission/fenced dictionary's entries
 * + history db. FAR too heavy for the serving process — standing law after the
 * 2026-07-29 Living 503: nothing from analytics may ever slow or block the
 * machine. So `compute_missing_monthly_metrics` runs ONLY inside the niced
 * analytics child (`analytics-snapshot.ts`), never on a request thread.
 */

/**
 * The first month with device-keyed capture. NEVER look further back: June 2026
 * raw begins only on 06-26 (prune) and predates the SQLite cutover, so it is not
 * comparable at any granularity.
 */
export const FIRST_METRICS_MONTH = '2026-07'

/**
 * `visitor_id` (the cookieless device id) shipped mid-2026-07-07. Before it the
 * visitor union falls back to `session_id`, so every session counts as its own
 * "visitor" — uniques inflate and the anonymous share understates (signed-in
 * sessions stop collapsing to one device, the bigger distortion: July's
 * signed-in "visitors" read 998 across the full month vs 170 real devices).
 * Windows therefore start no earlier than this date. From August onward the
 * floor is inert and every month measures its full length.
 */
export const VISITOR_ID_STABLE_FROM = '2026-07-08'

/** Months are normalized to a standard 31 days so they compare to each other. */
export const NORMALIZED_MONTH_DAYS = 31

export interface MonthlyMetrics {
  month: string
  window_start: string
  window_end: string
  days_counted: number
  site_visitors: number
  site_visits: number
  site_anon_visitors: number
  new_visitor_rate: number
  mission_visitors: number
  mission_visits: number
  mission_anon_visitors: number
  fenced_visitors: number
  public_dictionaries: number
  public_entries: number
  platform_dictionaries: number
  platform_entries: number
  mission_entries_created: number
  mission_entries_agent: number
  mission_entries_hand: number
  mission_entries_unattributed: number
  fenced_entries_created: number
  computed_at: string
  announced_at: string | null
}

type CorpusMetrics = Pick<MonthlyMetrics,
  'public_dictionaries' | 'public_entries' | 'platform_dictionaries' | 'platform_entries'
  | 'mission_entries_created' | 'mission_entries_agent' | 'mission_entries_hand'
  | 'mission_entries_unattributed' | 'fenced_entries_created'>

/**
 * Bucket → reporting group. Mission = real languages; fenced = conlang/glossary
 * (kept out of mission reporting per the 2026-07-08 decision); everything else
 * (`secure` internal test corpus, `delete`, unbucketed) counts in neither.
 */
export type MetricsGroup = 'mission' | 'fenced' | 'other'
export function group_for_bucket(bucket: string | null): MetricsGroup {
  if (bucket === 'public' || bucket === 'unlisted') return 'mission'
  if (bucket === 'conlang' || bucket === 'glossary') return 'fenced'
  return 'other'
}

export function next_month(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  return new Date(Date.UTC(year, mon, 1)).toISOString().slice(0, 7)
}
export function month_start_iso(month: string): string { return `${month}-01T00:00:00.000Z` }
export function month_end_iso(month: string): string { return `${next_month(month)}-01T00:00:00.000Z` }

/** Last calendar day of `month`, 'YYYY-MM-DD'. */
export function last_day_of_month(month: string): string {
  return new Date(Date.parse(month_end_iso(month)) - 86_400_000).toISOString().slice(0, 10)
}

/** Inclusive day count between two 'YYYY-MM-DD' days. */
export function days_between({ from, to }: { from: string, to: string }): number {
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000) + 1
}

/**
 * Scale a measured window up to a standard month. Uniques are a UNION — a
 * returning device adds nothing — so they can NEVER be scaled linearly. Instead
 * the measured new-visitor arrival rate extends the window forward.
 *
 * Safe here because that rate is FLAT: July measured 216/day across 24 days with
 * no decay (219 over the last 14, 213 over the last 7), since LD's audience is
 * dominated by first-time search arrivals rather than a saturating pool.
 *
 * For any month measured in full this is a NO-OP — only a partial-capture month
 * (July 2026) is ever extended, and only FORWARD. The pre-07-08 days are never
 * reconstructed: July 1–2 was not captured at all (the apex moved onto this
 * stack at the 07-03 cutover), so a literal July total is unknowable and must
 * not be asserted anywhere.
 */
export function normalize_visitors({ visitors, days_counted, new_visitor_rate, days = NORMALIZED_MONTH_DAYS }: {
  visitors: number
  days_counted: number
  new_visitor_rate: number
  days?: number
}): number {
  return Math.round(visitors + Math.max(0, days - days_counted) * new_visitor_rate)
}

/** A month row's site visitors scaled to a standard month — the figure to
 *  report and to chart. A no-op for any month measured in full. */
export function normalized_site_visitors(metrics: Pick<MonthlyMetrics, 'site_visitors' | 'days_counted' | 'new_visitor_rate'>): number {
  return normalize_visitors({ visitors: metrics.site_visitors, days_counted: metrics.days_counted, new_visitor_rate: metrics.new_visitor_rate })
}

/** True when the row measured less than its whole month (only July 2026 should
 *  ever be true) — the flag any UI needs to mark a figure as normalized. */
export function is_partial_capture(metrics: Pick<MonthlyMetrics, 'month' | 'days_counted'>): boolean {
  return metrics.days_counted < days_between({ from: `${metrics.month}-01`, to: last_day_of_month(metrics.month) })
}

/**
 * Every month from FIRST_METRICS_MONTH up to (but excluding) the current one
 * that has no row yet — oldest first, so a first deploy backfills July.
 */
export function missing_metric_months({ shared_db, now = new Date() }: {
  shared_db: Database.Database
  now?: Date
}): string[] {
  const current = now.toISOString().slice(0, 7)
  const have = new Set((shared_db.prepare('SELECT month FROM monthly_metrics').all() as { month: string }[]).map(row => row.month))
  const months: string[] = []
  for (let month = FIRST_METRICS_MONTH; month < current; month = next_month(month)) {
    if (!have.has(month)) months.push(month)
  }
  return months
}

interface Accum { visits: Set<string>, visitors: Set<string>, anon_visitors: Set<string> }
function accum(): Accum { return { visits: new Set(), visitors: new Set(), anon_visitors: new Set() } }

/**
 * Compute (but do not store) one month's metrics. Mirrors `rollup_month`'s bot
 * exclusion + anonymity rules exactly so this table agrees with
 * `dictionary_monthly_visitors` — verified against production on 2026-08-01 by
 * reproducing the frozen July `__site__` row to the digit.
 */
export function compute_monthly_metrics({ month, shared_db, logs_db, archive_db, now = new Date() }: {
  month: string
  shared_db: Database.Database
  logs_db: Database.Database
  archive_db?: Database.Database | null
  now?: Date
}): MonthlyMetrics {
  const first_day = `${month}-01`
  // max(month start, the date device ids became reliable). Only bites for 2026-07.
  const window_start_day = first_day >= VISITOR_ID_STABLE_FROM ? first_day : VISITOR_ID_STABLE_FROM
  const window_end_day = last_day_of_month(month)
  const window_start = `${window_start_day}T00:00:00.000Z`
  const month_end = month_end_iso(month)

  // Bot + anonymity classification from the FOREVER `log_daily_sessions` rows,
  // so it survives the raw prune and matches the daily/monthly rollups.
  const session_days = shared_db.prepare(`
    SELECT day, session_id, user_agent, heartbeats, has_user_id, webdriver
    FROM log_daily_sessions WHERE substr(day, 1, 7) = ?
  `).all(month) as { day: string, session_id: string, user_agent: string | null, heartbeats: number, has_user_id: number, webdriver: number | null }[]
  const bots = classify_ua_frequency_bot_sessions({
    sessions: session_days.map(row => ({ session_id: row.session_id, day: row.day, user_agent: row.user_agent, heartbeats: row.heartbeats, has_user_id: row.has_user_id === 1 })),
  })
  const signed_in = new Set<string>()
  for (const row of session_days) {
    if (is_bot_user_agent(row.user_agent) || row.webdriver === 1) bots.add(row.session_id)
    if (row.has_user_id === 1) signed_in.add(row.session_id)
  }

  const buckets = new Map<string, string | null>(
    (shared_db.prepare('SELECT id, bucket FROM dictionaries').all() as { id: string, bucket: string | null }[])
      .map(row => [row.id, row.bucket]),
  )

  const site = accum()
  const mission = accum()
  const fenced = accum()
  const add = (target: Accum, session_id: string, visitor_id: string | null): void => {
    const key = visitor_id ?? session_id
    target.visits.add(session_id)
    target.visitors.add(key)
    if (!signed_in.has(session_id)) target.anon_visitors.add(key)
  }

  for (const db of [logs_db, archive_db]) {
    if (!db) continue
    for (const row of db.prepare(`
      SELECT json_extract(context, '$.dictionary_id') dict, session_id, visitor_id
      FROM client_logs
      WHERE received_at >= ? AND received_at < ? AND message = ? AND session_id IS NOT NULL
        AND json_extract(context, '$.dictionary_id') IS NOT NULL
    `).all(window_start, month_end, DICTIONARY_OPENED) as { dict: string, session_id: string, visitor_id: string | null }[]) {
      if (bots.has(row.session_id)) continue
      const group = group_for_bucket(buckets.get(row.dict) ?? null)
      if (group === 'mission') add(mission, row.session_id, row.visitor_id)
      else if (group === 'fenced') add(fenced, row.session_id, row.visitor_id)
    }
    for (const row of db.prepare(`
      SELECT session_id, visitor_id FROM client_logs
      WHERE received_at >= ? AND received_at < ? AND message = ? AND session_id IS NOT NULL
    `).all(window_start, month_end, SESSION_START) as { session_id: string, visitor_id: string | null }[]) {
      if (bots.has(row.session_id)) continue
      add(site, row.session_id, row.visitor_id)
    }
  }

  // Days come from the CALENDAR window, not from days that happened to have
  // traffic — a genuinely quiet day is still a day the month had.
  const days_counted = days_between({ from: window_start_day, to: window_end_day })
  // Every unique visitor is, by definition, new exactly once in the window, so
  // the mean new-arrival rate is simply uniques / days.
  const new_visitor_rate = days_counted > 0 ? site.visitors.size / days_counted : 0

  return {
    month,
    window_start: window_start_day,
    window_end: window_end_day,
    days_counted,
    site_visitors: site.visitors.size,
    site_visits: site.visits.size,
    site_anon_visitors: site.anon_visitors.size,
    new_visitor_rate,
    mission_visitors: mission.visitors.size,
    mission_visits: mission.visits.size,
    mission_anon_visitors: mission.anon_visitors.size,
    fenced_visitors: fenced.visitors.size,
    ...compute_corpus({ month, shared_db }),
    computed_at: now.toISOString(),
    announced_at: null,
  }
}

/**
 * Corpus stock (as of compute time) + flow (entries created during the month
 * that still exist), with the flow split by `changes.api_key_id` in each
 * dictionary's history db: non-NULL = written by an agent through /api/v1,
 * NULL = a human typing in the UI. This is Jacob's metric (2026-08-01) — agent
 * vs hand, NOT insider vs curator, because "users come to us admins, so even if
 * we do imports, it's on their behalf".
 *
 * The join to SURVIVING entries is REQUIRED: history counts write EVENTS, and a
 * re-imported dictionary logs several inserts per surviving row (Enxet: 23,907
 * insert events for 11,971 live entries).
 */
function compute_corpus({ month, shared_db }: { month: string, shared_db: Database.Database }): CorpusMetrics {
  const from = month_start_iso(month)
  const to = month_end_iso(month)
  const dictionaries = shared_db.prepare('SELECT id, bucket, entry_count FROM dictionaries').all() as { id: string, bucket: string | null, entry_count: number | null }[]

  const totals: CorpusMetrics = {
    public_dictionaries: 0,
    public_entries: 0,
    platform_dictionaries: dictionaries.length,
    platform_entries: 0,
    mission_entries_created: 0,
    mission_entries_agent: 0,
    mission_entries_hand: 0,
    mission_entries_unattributed: 0,
    fenced_entries_created: 0,
  }

  for (const dictionary of dictionaries) {
    totals.platform_entries += dictionary.entry_count ?? 0
    if (dictionary.bucket === 'public') {
      totals.public_dictionaries++
      totals.public_entries += dictionary.entry_count ?? 0
    }
    const group = group_for_bucket(dictionary.bucket)
    if (group === 'other') continue

    const dict_db = open_read_only(dictionary_db_path(dictionary.id))
    if (!dict_db) continue
    let ids: string[] = []
    try {
      ids = (dict_db.prepare('SELECT id FROM entries WHERE created_at >= ? AND created_at < ?').all(from, to) as { id: string }[]).map(row => row.id)
    } catch { /* a dictionary db without an entries table is not a failure */ }
    dict_db.close()
    if (!ids.length) continue

    if (group === 'fenced') {
      totals.fenced_entries_created += ids.length
      continue
    }
    totals.mission_entries_created += ids.length

    const history = open_read_only(history_db_path(dictionary.id))
    if (!history) {
      totals.mission_entries_unattributed += ids.length
      continue
    }
    try {
      const lookup = history.prepare(`SELECT api_key_id FROM changes WHERE table_name = 'entries' AND op = 'insert' AND row_id = ? ORDER BY at LIMIT 1`)
      for (const id of ids) {
        const change = lookup.get(id) as { api_key_id: string | null } | undefined
        if (!change) totals.mission_entries_unattributed++
        else if (change.api_key_id) totals.mission_entries_agent++
        else totals.mission_entries_hand++
      }
    } catch {
      totals.mission_entries_unattributed += ids.length
    }
    history.close()
  }

  return totals
}

function open_read_only(path: string): Database.Database | null {
  if (!existsSync(path)) return null
  try {
    return new SqliteDatabase(path, { readonly: true, fileMustExist: true })
  } catch {
    return null
  }
}

export function save_monthly_metrics({ shared_db, metrics }: { shared_db: Database.Database, metrics: MonthlyMetrics }): void {
  shared_db.prepare(`
    INSERT INTO monthly_metrics (
      month, window_start, window_end, days_counted,
      site_visitors, site_visits, site_anon_visitors, new_visitor_rate,
      mission_visitors, mission_visits, mission_anon_visitors, fenced_visitors,
      public_dictionaries, public_entries, platform_dictionaries, platform_entries,
      mission_entries_created, mission_entries_agent, mission_entries_hand,
      mission_entries_unattributed, fenced_entries_created, computed_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?
    )
    ON CONFLICT(month) DO NOTHING
  `).run(
    metrics.month, metrics.window_start, metrics.window_end, metrics.days_counted,
    metrics.site_visitors, metrics.site_visits, metrics.site_anon_visitors, metrics.new_visitor_rate,
    metrics.mission_visitors, metrics.mission_visits, metrics.mission_anon_visitors, metrics.fenced_visitors,
    metrics.public_dictionaries, metrics.public_entries, metrics.platform_dictionaries, metrics.platform_entries,
    metrics.mission_entries_created, metrics.mission_entries_agent, metrics.mission_entries_hand,
    metrics.mission_entries_unattributed, metrics.fenced_entries_created, metrics.computed_at,
  )
}

export function get_monthly_metrics({ shared_db, month }: { shared_db: Database.Database, month: string }): MonthlyMetrics | null {
  return (shared_db.prepare('SELECT * FROM monthly_metrics WHERE month = ?').get(month) as MonthlyMetrics | undefined) ?? null
}

/**
 * Compute + store every month that is missing a row. Runs in the niced
 * analytics child ONLY. Returns the months written.
 */
export function compute_missing_monthly_metrics({ shared_db, logs_db, archive_db, now = new Date() }: {
  shared_db: Database.Database
  logs_db: Database.Database
  archive_db?: Database.Database | null
  now?: Date
}): string[] {
  const written: string[] = []
  for (const month of missing_metric_months({ shared_db, now })) {
    save_monthly_metrics({ shared_db, metrics: compute_monthly_metrics({ month, shared_db, logs_db, archive_db, now }) })
    written.push(month)
  }
  return written
}
