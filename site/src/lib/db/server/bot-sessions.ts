/**
 * UA-frequency crawler detection — complements `is_bot_user_agent` for headless
 * crawlers that spoof a plausible desktop-Chrome UA AND carry no
 * `navigator.webdriver` flag, so neither the UA regex nor the webdriver check
 * catches them. Their prod fingerprint (2026-07-01): one identical UA string
 * produced HUNDREDS of throwaway sessions in a day — each firing
 * `session_start` + `page_load` but NEVER a heartbeat (they leave before the 30s
 * heartbeat) — spread evenly across many Chrome majors.
 *
 * A session is classified a bot when it emitted ZERO heartbeats AND its
 * `user_agent` produced at least `MIN_UA_BOT_SESSIONS_PER_DAY` such zero-heartbeat
 * sessions on the SAME UTC day.
 *
 * The two-signal gate is deliberate — each alone is wrong (verified against prod):
 *   - heartbeat-absence alone would drop genuine sub-30s human reads (most human
 *     sessions never reach a heartbeat);
 *   - UA-frequency alone would nuke a classroom / NAT of real users behind one UA.
 * Requiring BOTH — a UA that is high-volume AND uniformly non-dwelling — is the
 * crawler signature. A real dwelling user emits a heartbeat and is excluded from
 * the tally, so real traffic can't push a shared UA over the line.
 *
 * Used by BOTH the forever rollup (`log-retention-cron.ts`, per rolled day) and the
 * live dashboard (`log-analytics.ts`, per window day) so the human/bot split is
 * identical hot and cold. The CLI (`scripts/logs.mjs`) mirrors this logic inline.
 */
export const MIN_UA_BOT_SESSIONS_PER_DAY = 20

export interface SessionActivity {
  session_id: string
  /** UTC day 'YYYY-MM-DD' the session belongs to (its first/earliest row's day). */
  day: string
  user_agent: string | null
  /** Number of heartbeat rows in the session (0 = never dwelled to the 30s heartbeat). */
  heartbeats: number
  /** True when the session was signed in — a real user, NEVER a crawler. */
  has_user_id: boolean
}

/** Composite tally key. `day` is a fixed 10-char YYYY-MM-DD (no space), so the first
 *  space unambiguously delimits it from the (space-containing) UA. */
function ua_day_key(session: SessionActivity): string {
  return `${session.day} ${session.user_agent}`
}

/**
 * Return the set of session ids that are UA-frequency crawlers. Pure — the caller
 * supplies the per-session activity (heartbeat count + UA + day).
 */
export function classify_ua_frequency_bot_sessions({ sessions, min_per_day = MIN_UA_BOT_SESSIONS_PER_DAY }: {
  sessions: SessionActivity[]
  min_per_day?: number
}): Set<string> {
  // Signed-in sessions are real users by definition — excluded from BOTH the tally
  // (not crawler evidence) and classification (never flagged). This protects a heavy
  // dev/admin who racks up 20+ short zero-heartbeat reloads on one UA in a day.
  const eligible = (session: SessionActivity): boolean => session.heartbeats === 0 && !!session.user_agent && !session.has_user_id
  const zero_hb_per_ua_day = new Map<string, number>()
  for (const session of sessions) {
    if (eligible(session))
      zero_hb_per_ua_day.set(ua_day_key(session), (zero_hb_per_ua_day.get(ua_day_key(session)) ?? 0) + 1)
  }
  const bots = new Set<string>()
  for (const session of sessions) {
    if (eligible(session) && (zero_hb_per_ua_day.get(ua_day_key(session)) ?? 0) >= min_per_day)
      bots.add(session.session_id)
  }
  return bots
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe(classify_ua_frequency_bot_sessions, () => {
    const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

    const make = (n: number, over: Partial<SessionActivity> = {}): SessionActivity[] =>
      Array.from({ length: n }, (_, index) => ({ session_id: `s${index}`, day: '2026-07-01', user_agent: CHROME, heartbeats: 0, has_user_id: false, ...over }))

    it('flags a high-volume, zero-heartbeat, shared-UA cluster', () => {
      expect(classify_ua_frequency_bot_sessions({ sessions: make(25) }).size).toBe(25)
    })

    it('does NOT flag when the cluster is below the daily threshold', () => {
      expect(classify_ua_frequency_bot_sessions({ sessions: make(19) }).size).toBe(0)
    })

    it('never flags a session that emitted a heartbeat, even amid a bot cluster on the same UA', () => {
      const sessions = [...make(24), { session_id: 'human', day: '2026-07-01', user_agent: CHROME, heartbeats: 3, has_user_id: false }]
      const bots = classify_ua_frequency_bot_sessions({ sessions })
      expect(bots.has('human')).toBe(false)
      expect(bots.size).toBe(24)
    })

    it('never flags a SIGNED-IN session (protects a heavy dev/admin on a shared UA)', () => {
      // 24 anonymous crawlers + 1 signed-in dev with many zero-heartbeat reloads,
      // all on the same UA. The dev must stay human even above the threshold.
      const sessions = [...make(24), { session_id: 'admin', day: '2026-07-01', user_agent: CHROME, heartbeats: 0, has_user_id: true }]
      const bots = classify_ua_frequency_bot_sessions({ sessions })
      expect(bots.has('admin')).toBe(false)
      expect(bots.size).toBe(24)
    })

    it('keys by day — the same UA below-threshold on two days is not a bot', () => {
      const sessions = [...make(15), ...make(15, { day: '2026-07-02' }).map((session, index) => ({ ...session, session_id: `t${index}` }))]
      expect(classify_ua_frequency_bot_sessions({ sessions }).size).toBe(0)
    })

    it('ignores sessions with no user_agent (server rows / unknown)', () => {
      expect(classify_ua_frequency_bot_sessions({ sessions: make(30, { user_agent: null }) }).size).toBe(0)
    })

    it('honors an injected min_per_day (for tests / tuning)', () => {
      expect(classify_ua_frequency_bot_sessions({ sessions: make(3), min_per_day: 3 }).size).toBe(3)
    })
  })
}
