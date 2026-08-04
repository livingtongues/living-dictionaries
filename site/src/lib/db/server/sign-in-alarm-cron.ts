import type Database from 'better-sqlite3'
import type { SignInHealth } from './log-analytics'
import { env } from '$env/dynamic/private'
import { ROOM_NOTIFICATIONS } from '$lib/chat/constants'
import { deliver_system_message } from '$lib/server/chat/system-message'
import { log_server_event } from '$lib/server/log-server-event'
import { read_analytics_snapshot } from './analytics-snapshot'
import { get_shared_db } from './shared-db'

/**
 * THE ZERO-LOGINS ALARM — fires when a way of signing in STOPS WORKING.
 *
 * Living Dictionaries' Google sign-in was dead for thirty days (2026-07-04 →
 * 2026-08-02) and no instrument on the site said so. It carried 83% of all
 * logins; on its first day back it carried 23 of 23 and created 7 new accounts
 * against a July median of 2. It broke silently because a third-party script
 * that fails to load produces FEWER log rows, not more — there is no error to
 * cluster, no 500 to count, nothing for an error dashboard to show. The only
 * instrument that could ever have caught it is the integration's OWN success
 * metric.
 *
 * This is a PRODUCT instrument: it tells Jacob the truth about a running site.
 * It is explicitly NOT agent-verification tooling — the thing that failed for a
 * month was verified as "the fix was applied" every single night.
 *
 * Needs no new telemetry (`auth_login` has carried `{ method, created }` since
 * June) and — critically — NO QUERIES on a request path: the numbers come from
 * the daily analytics CHECKPOINT file (`analytics-snapshot.ts`), which is a
 * `readFileSync`. See `build_sign_in_health` for the rule.
 */

/** `db_metadata` key holding this alarm's memory (see `AlarmState`). */
export const SIGN_IN_ALARM_STATE_KEY = 'sign_in_alarm_state'
/** While a method stays dead, re-announce this often — loud once, then a weekly reminder, never daily noise. */
export const REMIND_AFTER_DAYS = 7

interface MethodState {
  /** The judged day this method was first found flatlined in the current outage. */
  since: string
  /** The judged day we last posted about it. */
  announced_for: string
}
interface AlarmState { down: Record<string, MethodState> }

export function read_alarm_state(db: Database.Database): AlarmState {
  const row = db.prepare('SELECT value FROM db_metadata WHERE key = ?').get(SIGN_IN_ALARM_STATE_KEY) as { value: string } | undefined
  try {
    const parsed = JSON.parse(row?.value ?? '') as AlarmState
    return parsed?.down ? parsed : { down: {} }
  } catch {
    return { down: {} }
  }
}

function write_alarm_state(db: Database.Database, state: AlarmState): void {
  db.prepare('INSERT INTO db_metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(SIGN_IN_ALARM_STATE_KEY, JSON.stringify(state))
}

function days_between(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

export interface AlarmDecision {
  /** Methods to raise the alarm for now (new outage, or the weekly reminder). */
  announce: { method: string, since: string, down_days: number, daily_average_before: number, is_reminder: boolean }[]
  /** Methods that were down and are working again. */
  recovered: { method: string, since: string, down_days: number, logins: number }[]
  next_state: AlarmState
}

/**
 * Pure decision step — what to say, given today's reading and what we already
 * said. Split out so the wording and the anti-noise rules are unit-testable
 * without a database, a checkpoint file or a chat room.
 */
export function decide_sign_in_alarm({ sign_in, state }: { sign_in: SignInHealth, state: AlarmState }): AlarmDecision {
  const decision: AlarmDecision = { announce: [], recovered: [], next_state: { down: {} } }
  const flatlined = new Set(sign_in.flatlined)

  for (const method of sign_in.methods) {
    const previous = state.down[method.method]
    if (flatlined.has(method.method)) {
      const since = previous?.since ?? sign_in.day
      const is_reminder = Boolean(previous)
      const due = !previous || days_between(previous.announced_for, sign_in.day) >= REMIND_AFTER_DAYS
      decision.next_state.down[method.method] = { since, announced_for: due ? sign_in.day : (previous?.announced_for ?? sign_in.day) }
      if (due) {
        decision.announce.push({
          method: method.method,
          since,
          down_days: days_between(since, sign_in.day) + 1,
          daily_average_before: method.daily_average_before,
          is_reminder,
        })
      }
      continue
    }
    // Recovery is only interesting if we said it was broken.
    if (previous && method.logins > 0)
      decision.recovered.push({ method: method.method, since: previous.since, down_days: days_between(previous.since, sign_in.day), logins: method.logins })
  }

  // A method that vanished from the reading entirely (no rows at all in the
  // window) keeps its state rather than silently "recovering".
  for (const [method, value] of Object.entries(state.down)) {
    if (!decision.next_state.down[method] && !decision.recovered.some(row => row.method === method))
      decision.next_state.down[method] = value
  }
  return decision
}

const method_label = (method: string): string => method === 'email' ? 'Email one-time code' : method.charAt(0).toUpperCase() + method.slice(1)

/** The message text. Verdict first — this must read as an alarm, not a report. */
export function build_alarm_message({ decision, sign_in }: { decision: AlarmDecision, sign_in: SignInHealth }): { text: string, html: string } | null {
  if (!decision.announce.length && !decision.recovered.length)
    return null
  const lines: string[] = []
  for (const row of decision.announce) {
    lines.push(row.is_reminder
      ? `🔴 ${method_label(row.method)} sign-in is STILL producing zero logins — ${row.down_days} days now (since ${row.since}).`
      : `🔴 ${method_label(row.method)} sign-in produced ZERO logins on ${sign_in.day}, after averaging ${row.daily_average_before}/day the week before. It is very likely broken.`)
  }
  for (const row of decision.recovered)
    lines.push(`✅ ${method_label(row.method)} sign-in is working again — ${row.logins} logins on ${sign_in.day}, after ${row.down_days} day(s) at zero.`)

  const mix = sign_in.methods.map(method => `${method.logins} ${method_label(method.method).toLowerCase()}`).join(' · ')
  lines.push(`${sign_in.day}: ${sign_in.logins} logins total (${mix || 'none'}), ${sign_in.new_accounts} new accounts.`)

  const text = lines.join('\n')
  const html = `<p>${lines.map(escape_html).join('<br />')}</p>`
  return { text, html }
}

function escape_html(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Deep-link base for the cron (no request context). Tracks the deployed domain via ORIGIN. */
const SITE_URL = env.ORIGIN || 'https://new.livingdictionaries.app'

/**
 * The cron body. Reads the daily checkpoint, decides, posts into the admin chat
 * `notifications` room, and remembers what it said. Never throws.
 */
export async function run_sign_in_alarm_sweep(): Promise<void> {
  try {
    const snapshot = read_analytics_snapshot({ range: '30', audience: 'humans' })
    const sign_in = snapshot?.payload?.sign_in
    if (!sign_in) {
      // Not an alarm — the checkpoint just hasn't been computed in this format yet.
      console.info('[sign-in-alarm] no sign-in reading in the analytics checkpoint yet — skipping.')
      return
    }
    const db = get_shared_db()
    const state = read_alarm_state(db)
    const decision = decide_sign_in_alarm({ sign_in, state })
    const message = build_alarm_message({ decision, sign_in })
    if (message)
      await deliver_system_message({ db, room_id: ROOM_NOTIFICATIONS, body_html: message.html, body_text: message.text, base_url: SITE_URL })
    write_alarm_state(db, decision.next_state)
    log_server_event({
      level: decision.announce.length ? 'error' : 'info',
      message: 'sign_in_health_checked',
      context: {
        day: sign_in.day,
        logins: sign_in.logins,
        new_accounts: sign_in.new_accounts,
        by_method: Object.fromEntries(sign_in.methods.map(method => [method.method, method.logins])),
        flatlined: sign_in.flatlined,
        announced: decision.announce.map(row => row.method),
        recovered: decision.recovered.map(row => row.method),
      },
    })
  } catch (error) {
    console.error('[sign-in-alarm] failed:', error)
    log_server_event({ level: 'error', message: 'sign_in_alarm_failed', error })
  }
}

if (import.meta.vitest) {
  function health(overrides: Partial<SignInHealth> & { methods: SignInHealth['methods'] }): SignInHealth {
    return {
      day: '2026-07-05',
      logins: 0,
      new_accounts: 0,
      daily: [],
      flatlined: overrides.methods.filter(method => method.flatlined).map(method => method.method),
      ...overrides,
    }
  }
  const google_down = { method: 'google', logins: 0, active_days_before: 7, daily_average_before: 12.4, last_login_at: '2026-07-04T01:00:00.000Z', flatlined: true }
  const email_ok = { method: 'email', logins: 5, active_days_before: 7, daily_average_before: 6, last_login_at: '2026-07-05T22:00:00.000Z', flatlined: false }

  describe(decide_sign_in_alarm, () => {
    it('raises the alarm the first day a live method goes to zero', () => {
      const decision = decide_sign_in_alarm({ sign_in: health({ methods: [google_down, email_ok], logins: 5 }), state: { down: {} } })
      expect(decision.announce).toEqual([{ method: 'google', since: '2026-07-05', down_days: 1, daily_average_before: 12.4, is_reminder: false }])
      expect(decision.next_state.down.google).toEqual({ since: '2026-07-05', announced_for: '2026-07-05' })
    })

    it('stays SILENT on the following days — one alarm, not thirty', () => {
      const state = { down: { google: { since: '2026-07-05', announced_for: '2026-07-05' } } }
      const decision = decide_sign_in_alarm({ sign_in: health({ day: '2026-07-08', methods: [google_down, email_ok] }), state })
      expect(decision.announce).toEqual([])
      expect(decision.next_state.down.google.announced_for).toBe('2026-07-05')
    })

    it('reminds once a week while it is still dead', () => {
      const state = { down: { google: { since: '2026-07-05', announced_for: '2026-07-05' } } }
      const decision = decide_sign_in_alarm({ sign_in: health({ day: '2026-07-12', methods: [google_down, email_ok] }), state })
      expect(decision.announce[0]).toEqual({ method: 'google', since: '2026-07-05', down_days: 8, daily_average_before: 12.4, is_reminder: true })
    })

    it('reports the recovery, then forgets', () => {
      const state = { down: { google: { since: '2026-07-05', announced_for: '2026-07-05' } } }
      const back = { ...google_down, logins: 23, flatlined: false }
      const decision = decide_sign_in_alarm({ sign_in: health({ day: '2026-08-03', methods: [back, email_ok] }), state })
      expect(decision.recovered).toEqual([{ method: 'google', since: '2026-07-05', down_days: 29, logins: 23 }])
      expect(decision.next_state.down).toEqual({})
    })

    it('says nothing at all when every method is working', () => {
      const decision = decide_sign_in_alarm({ sign_in: health({ methods: [email_ok, { ...google_down, logins: 9, flatlined: false }] }), state: { down: {} } })
      expect(build_alarm_message({ decision, sign_in: health({ methods: [email_ok] }) })).toBe(null)
    })
  })

  describe(build_alarm_message, () => {
    it('leads with the verdict and names the baseline it fell from', () => {
      const sign_in = health({ methods: [google_down, email_ok], logins: 5, new_accounts: 1 })
      const decision = decide_sign_in_alarm({ sign_in, state: { down: {} } })
      expect(build_alarm_message({ decision, sign_in })?.text).toBe([
        '🔴 Google sign-in produced ZERO logins on 2026-07-05, after averaging 12.4/day the week before. It is very likely broken.',
        '2026-07-05: 5 logins total (0 google · 5 email one-time code), 1 new accounts.',
      ].join('\n'))
    })
  })
}
