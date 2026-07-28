import { is_bot_user_agent } from '$lib/utils/bot-user-agent'

/**
 * Is THIS request a crawler/automated agent, for the purposes of skipping client
 * work a robot can't use (the dictionary layout's whole offline-DB boot)?
 *
 * Detection itself is the fleet-canonical `$lib/utils/bot-user-agent.ts` and
 * nothing else — one copy, adopted verbatim in house/LD/tutor, guarded by
 * `bot-user-agent.parity.test.ts`. Never grow a second matcher here.
 *
 * ⚠️ It MUST be `is_bot_user_agent`, never the sibling export
 * `is_bot_or_unknown_user_agent`. They have identical signatures and
 * deliberately OPPOSITE behaviour on a missing User-Agent. house's fail-closed
 * variant gates a background download; THIS gates the entire offline database,
 * so failing closed on a UA-less request would hand that visitor an empty
 * entries list and block every edit. A missing UA is a person here.
 *
 * This wrapper adds only the two environments where a headless browser is a
 * HUMAN's proxy and must keep the full app:
 *
 *  - **dev** — the local dev server, where a screenshot/e2e/debug browser is us;
 *  - **an e2e run** — every LD e2e harness boots `node build` with
 *    `E2E_EXPOSE_OTP=true` (a flag that can only ever be set outside production,
 *    since it returns login codes inline), and puppeteer's default UA says
 *    `HeadlessChrome`, which `is_bot_user_agent` correctly calls a robot.
 */
export function is_bot_request({ user_agent, is_dev, e2e_expose_otp }: {
  user_agent: string | null
  is_dev: boolean
  e2e_expose_otp: string | undefined
}): boolean {
  if (is_dev || e2e_expose_otp === 'true')
    return false
  return is_bot_user_agent(user_agent)
}

if (import.meta.vitest) {
  describe(is_bot_request, () => {
    const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
    const HEADLESS = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/136.0.0.0 Safari/537.36'
    const base = { is_dev: false, e2e_expose_otp: undefined }

    test('a crawler in production is a robot', () => {
      expect(is_bot_request({ ...base, user_agent: GOOGLEBOT })).toBe(true)
    })
    test('a real browser never is', () => {
      expect(is_bot_request({ ...base, user_agent: CHROME })).toBe(false)
      expect(is_bot_request({ ...base, user_agent: null })).toBe(false)
    })
    test('headless Chrome is a robot in production but OUR browser in dev or an e2e run', () => {
      expect(is_bot_request({ ...base, user_agent: HEADLESS })).toBe(true)
      expect(is_bot_request({ ...base, user_agent: HEADLESS, is_dev: true })).toBe(false)
      expect(is_bot_request({ ...base, user_agent: HEADLESS, e2e_expose_otp: 'true' })).toBe(false)
    })
    test('even a declared crawler UA passes through in dev (a screenshot script spoofing one)', () => {
      expect(is_bot_request({ ...base, user_agent: GOOGLEBOT, is_dev: true })).toBe(false)
    })

    /**
     * The 2026-07-27 outage of function: these people were served a null dict
     * session — no leader election, no worker, no offline database, so an empty
     * entries list and every edit blocked. Each one is a REGRESSION GUARD on the
     * gate itself, not just on the matcher.
     */
    describe('people the old substring matcher blanked the app for', () => {
      test('a CUBOT phone is a person (the brand name contains "bot")', () => {
        expect(is_bot_request({ ...base, user_agent: 'Mozilla/5.0 (Linux; Android 12; CUBOT NOTE 20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Mobile Safari/537.36' })).toBe(false)
      })
      test('WhatsApp\'s in-app browser is a person — the most common way a shared link is opened', () => {
        expect(is_bot_request({ ...base, user_agent: 'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.6.78' })).toBe(false)
      })
      test('WhatsApp\'s link unfurler still IS a robot (bare UA, no browser token)', () => {
        expect(is_bot_request({ ...base, user_agent: 'WhatsApp/2.19.81 A' })).toBe(true)
      })
      test('Sogou\'s consumer mobile browser is a person; its web spider is not', () => {
        expect(is_bot_request({ ...base, user_agent: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 SogouMobileBrowser/5.28.1' })).toBe(false)
        expect(is_bot_request({ ...base, user_agent: 'Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)' })).toBe(true)
      })
    })

    test('a MISSING User-Agent is a PERSON — failing closed here blanks the whole app', () => {
      // Guards against someone swapping in `is_bot_or_unknown_user_agent`, whose
      // signature is identical and whose missing-UA policy is the opposite.
      expect(is_bot_request({ ...base, user_agent: null })).toBe(false)
      expect(is_bot_request({ ...base, user_agent: '' })).toBe(false)
    })
  })
}
