import { is_bot_user_agent } from '$lib/debug/parse-user-agent'

/**
 * Is THIS request a crawler/automated agent, for the purposes of skipping client
 * work a robot can't use (the dictionary layout's whole offline-DB boot)?
 *
 * Detection itself is `is_bot_user_agent` and nothing else — one source of truth,
 * shared with the analytics (house grew two helpers that disagreed; don't).
 * This adds only the two environments where a headless browser is a HUMAN's
 * proxy and must keep the full app:
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
  })
}
