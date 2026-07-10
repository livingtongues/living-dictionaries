/**
 * Plain-language "At a glance" story for the top of `/admin/analytics` and
 * `/admin/health`. Translates the already-computed `LogAnalytics` into a few
 * sentences a human can act on — user numbers, how the experience feels, where
 * the site is being used, and what (if anything) needs attention — instead of
 * making Jacob read error lists and percentile tables. Pure derivation, no new
 * queries; the views render it via `AtAGlance.svelte`.
 */
import type { LogAnalytics } from '$lib/db/server/log-analytics'
import { format_ms } from './dashboard-format'
import { format_number } from '$lib/constants'

export type GlanceTone = 'ok' | 'watch' | 'act'

export interface GlanceAttentionItem {
  tone: GlanceTone
  text: string
}

export interface Glance {
  people: {
    /** Big number: distinct signed-in users in the window. */
    users: number
    sessions: number
    headline: string
    /** Week-over-week session change as a fraction; null when not computable. */
    trend_pct: number | null
    trend_text: string
    /** Daily sessions for a micro-sparkline. */
    spark: number[]
  }
  experience: {
    tone: GlanceTone
    headline: string
    detail: string
    /** The known pain point, phrased plainly; null when nothing stands out. */
    pain: string | null
  }
  places: {
    headline: string
    detail: string
  } | null
  attention: {
    tone: GlanceTone
    items: GlanceAttentionItem[]
  }
}

const WORST: Record<GlanceTone, number> = { ok: 0, watch: 1, act: 2 }
function worst_tone(items: GlanceAttentionItem[]): GlanceTone {
  return items.reduce<GlanceTone>((acc, item) => (WORST[item.tone] > WORST[acc] ? item.tone : acc), 'ok')
}

export function build_glance({ analytics }: { analytics: LogAnalytics }): Glance {
  const { totals, daily, window_days, performance, errors_by_version, server_faults, sync_health, boot_health, build_adoption, pipeline, top_dictionaries, geo, web_vitals } = analytics

  // --- People ---
  let trend_pct: number | null = null
  if (daily.length >= 14) {
    const last7 = daily.slice(-7).reduce((sum, point) => sum + point.sessions, 0)
    const prior7 = daily.slice(-14, -7).reduce((sum, point) => sum + point.sessions, 0)
    if (prior7 > 0)
      trend_pct = (last7 - prior7) / prior7
  }
  const trend_text = trend_pct === null
    ? 'not enough history for a trend yet'
    : Math.abs(trend_pct) < 0.05
      ? 'steady vs last week'
      : `${trend_pct > 0 ? 'up' : 'down'} ${Math.round(Math.abs(trend_pct) * 100)}% vs last week`
  const people: Glance['people'] = {
    users: totals.unique_users,
    sessions: totals.sessions,
    headline: `${format_number(totals.unique_users)} ${totals.unique_users === 1 ? 'person' : 'people'} signed in · ${format_number(totals.sessions)} visits`,
    trend_pct,
    trend_text,
    spark: daily.map(point => point.sessions),
  }

  // --- Experience ---
  const perf_by_name = new Map(performance.summary.map(metric => [metric.name, metric]))
  const page_load = perf_by_name.get('page_load')
  const within = performance.nav_sections.find(section => section.section === 'within_dictionary')
  const entering = performance.nav_sections.find(section => section.section === 'entering_dictionary')
  const nav = within ?? perf_by_name.get('navigation')
  const cold_boot = performance.dict_boot.cold
  const lcp = web_vitals.find(vital => vital.metric === 'LCP')

  const load_ok = page_load?.p50 == null || page_load.p50 <= 2500
  const nav_ok = nav?.p50 == null || nav.p50 <= 300
  const lcp_ok = lcp?.p75 == null || lcp.p75 <= 2500
  const experience_tone: GlanceTone = load_ok && nav_ok && lcp_ok ? 'ok' : (!load_ok && !nav_ok ? 'act' : 'watch')

  const experience_bits: string[] = []
  if (page_load?.p50 != null)
    experience_bits.push(`pages load in ~${format_ms(page_load.p50)}`)
  if (nav?.p50 != null)
    experience_bits.push(nav.p50 <= 150 ? `moving around inside a dictionary is instant (~${format_ms(nav.p50)})` : `in-dictionary moves take ~${format_ms(nav.p50)}`)
  const experience_detail = experience_bits.length ? `${capitalize(experience_bits.join('; '))}.` : 'No speed samples yet — sentences appear once real visits land.'

  let pain: string | null = null
  if (cold_boot.count > 0 && cold_boot.p50 != null) {
    pain = `First-time open of a dictionary downloads it to the device — typically ${format_ms(cold_boot.p50)}, up to ${format_ms(cold_boot.p95)} for big dictionaries on slow connections.`
  } else if (entering && entering.p50 != null && (entering.p95 ?? 0) > 1000) {
    pain = `Entering a dictionary from the homepage takes ~${format_ms(entering.p50)} (up to ${format_ms(entering.p95)}) — that hop downloads the dictionary the first time.`
  }

  const experience: Glance['experience'] = {
    tone: experience_tone,
    headline: experience_tone === 'ok' ? 'The site feels fast' : experience_tone === 'watch' ? 'Mostly fast, one thing to watch' : 'The site is feeling slow',
    detail: experience_detail,
    pain,
  }

  // --- Places ---
  let places: Glance['places'] = null
  const dict_names = top_dictionaries.dictionaries.slice(0, 3).map(row => row.name ?? row.url ?? row.dictionary_id)
  const area_names = geo.areas.slice(0, 3).map(area => area.key)
  if (dict_names.length || area_names.length) {
    places = {
      headline: dict_names.length ? `Most-visited: ${dict_names.join(', ')}` : 'No dictionary visits yet',
      detail: area_names.length ? `Visitors mostly from ${area_names.join(', ')}` : 'No located visitors yet',
    }
  }

  // --- Attention (action steps) ---
  const items: GlanceAttentionItem[] = []
  if (pipeline.missing_syncable_tables.length)
    items.push({ tone: 'act', text: `Schema drift: ${pipeline.missing_syncable_tables.join(', ')} missing from shared.db — ship a backfill migration.` })
  if (server_faults.total > 0)
    items.push({ tone: 'act', text: `${format_number(server_faults.total)} server-side fault${server_faults.total === 1 ? '' : 's'} — these are real, current-code problems (see Server faults).` })
  if (sync_health.client_behind.current > 50)
    items.push({ tone: 'act', text: `A sync retry storm is running on the CURRENT build (${format_number(sync_health.client_behind.current)} client_behind rows) — a live regression.` })
  if (boot_health.failed_sessions > 0 && (boot_health.non_recovery_pct ?? 0) >= 0.5)
    items.push({ tone: 'act', text: `${format_number(boot_health.failed_sessions)} visitor${boot_health.failed_sessions === 1 ? '' : 's'} failed to open a dictionary and most never saw content (see Fresh-viewer boot health).` })
  if (errors_by_version.current > 0 && totals.real_errors > 0)
    items.push({ tone: 'watch', text: `${format_number(totals.real_errors)} real error${totals.real_errors === 1 ? '' : 's'} this window, ${format_number(errors_by_version.current)} on the current build (see Error clusters).` })
  if (sync_health.stuck_pairs > 0)
    items.push({ tone: 'watch', text: `${format_number(sync_health.stuck_pairs)} editor tab${sync_health.stuck_pairs === 1 ? ' is' : 's are'} stuck syncing — a reload clears them (named under Sync health).` })
  if (build_adoption.stale > 0)
    items.push({ tone: 'watch', text: `${format_number(build_adoption.stale)} session${build_adoption.stale === 1 ? '' : 's'} stranded on a build ≥3 days old — they can't receive fixes until a hard reload.` })
  if (!items.length)
    items.push({ tone: 'ok', text: 'Nothing needs your attention right now. 🎉' })

  return { people, experience, places, attention: { tone: worst_tone(items), items } }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
