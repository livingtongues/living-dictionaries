/**
 * THE single source of truth for "is this User-Agent an automated client?".
 *
 * It used to be three: a server gate (`$lib/server/is-bot.ts`), an analytics
 * classifier (`$lib/debug/parse-user-agent.ts`) and a mirrored regex in
 * `scripts/logs.mjs`. Two of them exported `is_bot_user_agent` with identical
 * signatures and DELIBERATELY OPPOSITE behaviour on a missing User-Agent, with
 * nothing but a doc comment stopping an agent importing the wrong one. That
 * split stopped being cosmetic the week crawler classification became
 * load-bearing in four places at once (2026-07-26 nightly review): it now gates
 * a 14.5 MB background download, the reader's person/place/word underlines, the
 * analytics human/bot split, and whether an error is even SHOWN to the nightly
 * triage. A misdetection is a visible feature loss, not a wasted download.
 *
 * So: one marker list, one matcher, and the missing-UA policy expressed as TWO
 * explicitly-named exports rather than a comment:
 *
 *   `is_bot_user_agent`            — unknown UA is NOT a bot. Classifies
 *                                    historical rows for the dashboards, where
 *                                    silently bucketing unknowns as crawlers
 *                                    would fabricate a bot population.
 *   `is_bot_or_unknown_user_agent` — unknown UA IS a bot. Fails closed, for the
 *                                    warm-up gate: a UA-less client can't run
 *                                    the local DB anyway.
 *
 * `scripts/logs.mjs` cannot import from `site/` (it runs `node` from stdin
 * inside the prod container) and mirrors `BOT_MARKERS` + the two regexes by
 * hand. Change one, change the other.
 */

/**
 * Named markers (case-insensitive substrings) for clients we actually see in
 * `client_logs`. High confidence — no boundary rules needed, these tokens don't
 * occur in consumer UAs.
 */
const BOT_MARKERS: readonly string[] = [
  // Search engines — the volume
  'googlebot',
  'google-inspectiontool',
  'googleother',
  'google-extended',
  'storebot-google',
  'bingbot',
  'bingpreview',
  'applebot',
  'baiduspider',
  'yandex',
  'duckduckbot',
  'petalbot',
  'bytespider',
  'seznambot',
  'slurp',
  // AI crawlers
  'gptbot',
  'oai-searchbot',
  'chatgpt-user',
  'claudebot',
  'anthropic-ai',
  'perplexitybot',
  'ccbot',
  // Social / link unfurlers (`whatsapp` is NOT here — see WHATSAPP_UNFURLER)
  'facebookexternalhit',
  'twitterbot',
  'slackbot',
  'linkedinbot',
  'telegrambot',
  'discordbot',
  'embedly',
  'skypeuripreview',
  'quora link preview',
  'pinterest',
  // SEO / audit tools
  'ahrefsbot',
  'semrushbot',
  'dataforseo',
  'mj12bot',
  'dotbot',
  'screaming frog',
  'chrome-lighthouse',
  'pagespeed',
  // Headless / scripted clients
  'headlesschrome',
  'headless',
  'phantomjs',
  'puppeteer',
  'playwright',
  'python-requests',
  'curl/',
  'wget',
  'go-http-client',
  'axios/',
  'node-fetch',
]

/**
 * The generic tail — anything self-describing as a bot / crawler / spider,
 * which is how the long list of no-name crawlers gets caught (and how the real
 * `Sogou web spider` is caught without the bare `sogou` marker that also
 * matched Sogou's consumer mobile BROWSER).
 *
 * `(?![a-z])` is the word boundary: it keeps `botanical`, `bots.example` and
 * `Abbott` out. It does NOT save us from device brands that END in the token,
 * which is what `DEVICE_FALSE_POSITIVES` is for.
 */
const GENERIC_BOT_PATTERN = /(?:bot|crawler|spider)(?![a-z])/i

/**
 * Consumer hardware whose model name contains a bot/crawler/spider token.
 * Stripped from the UA before the generic tail runs, so a CUBOT phone stays a
 * person — while a genuine crawler on the same string is still caught by its
 * own marker. CUBOT is a real Android phone brand and was matching the bare
 * `bot` substring, i.e. losing those readers their underlines and local DB.
 */
const DEVICE_FALSE_POSITIVES = /cubot/gi

/**
 * WhatsApp's link unfurler sends a BARE `WhatsApp/2.x` User-Agent. WhatsApp's
 * in-app browser sends a full `Mozilla/5.0 …` browser UA — a real person
 * reading in an embedded WebView, who must keep the whole reader. So the
 * marker only counts without a `mozilla` token.
 */
function is_whatsapp_unfurler(ua: string): boolean {
  return ua.includes('whatsapp') && !ua.includes('mozilla')
}

/** Shared matcher. Callers decide what a MISSING User-Agent means. */
function matches_bot_markers(user_agent: string): boolean {
  const ua = user_agent.toLowerCase()
  if (BOT_MARKERS.some(marker => ua.includes(marker)))
    return true
  if (is_whatsapp_unfurler(ua))
    return true
  return GENERIC_BOT_PATTERN.test(ua.replace(DEVICE_FALSE_POSITIVES, ''))
}

/**
 * True when the User-Agent looks automated. A MISSING UA is NOT a bot — use
 * this for classifying stored rows (analytics, rollups, log triage), where
 * bucketing unknowns as crawlers would invent a bot population that never
 * existed.
 */
export function is_bot_user_agent(user_agent: string | null | undefined): boolean {
  if (!user_agent)
    return false
  return matches_bot_markers(user_agent)
}

/**
 * True when the User-Agent looks automated OR is missing — the fail-closed
 * variant that gates the reader's ~14.5 MB local-first warm-up (`+layout.server.ts`
 * → `page.data.is_bot`). Real browsers always send a UA, and a UA-less client
 * can't run the local DB anyway.
 */
export function is_bot_or_unknown_user_agent(user_agent: string | null | undefined): boolean {
  if (!user_agent)
    return true
  return matches_bot_markers(user_agent)
}

if (import.meta.vitest) {
  const BOTS = [
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.128 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
    'Mozilla/5.0 (compatible; Baiduspider-render/2.0; +http://www.baidu.com/search/spider.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.0; +https://openai.com/gptbot',
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.200 Mobile Safari/537.36 (compatible; GoogleOther)',
    'facebookexternalhit/1.1',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.0.0 Safari/537.36',
    'curl/8.5.0',
    // Generic tail — no named marker, self-describing
    'Mozilla/5.0 (compatible; SomeNewBot/1.0; +http://example.com/bot)',
    'Mozilla/5.0 (compatible; UnknownCrawler/3.2)',
  ]

  const HUMANS = [
    // Jacob's phone, from client_logs 2026-07-26
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
  ]

  describe(is_bot_user_agent, () => {
    for (const ua of BOTS) {
      it(`flags ${ua.slice(0, 48)}…`, () => {
        expect(is_bot_user_agent(ua)).toBe(true)
      })
    }

    for (const ua of HUMANS) {
      it(`passes ${ua.slice(0, 48)}…`, () => {
        expect(is_bot_user_agent(ua)).toBe(false)
      })
    }

    it('a missing User-Agent is NOT a bot (analytics must not invent crawlers)', () => {
      expect(is_bot_user_agent(null)).toBe(false)
      expect(is_bot_user_agent('')).toBe(false)
    })

    describe('false positives the old substring rules produced', () => {
      it('a CUBOT phone is a person, not a bot', () => {
        expect(is_bot_user_agent('Mozilla/5.0 (Linux; Android 11; CUBOT NOTE 20 Build/RP1A.200720.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Mobile Safari/537.36')).toBe(false)
        expect(is_bot_user_agent('Mozilla/5.0 (Linux; Android 12; CUBOT_KING_KONG_5_PRO) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36')).toBe(false)
      })

      it('Sogou\'s consumer mobile BROWSER is a person; its spider is not', () => {
        expect(is_bot_user_agent('Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 SogouMobileBrowser/5.28.1')).toBe(false)
        expect(is_bot_user_agent('Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)')).toBe(true)
      })

      it('WhatsApp\'s in-app browser is a person; its unfurler is not', () => {
        expect(is_bot_user_agent('Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.6.78')).toBe(false)
        expect(is_bot_user_agent('WhatsApp/2.19.81 A')).toBe(true)
      })

      it('a word ending in the token is not a crawler', () => {
        expect(is_bot_user_agent('Mozilla/5.0 (Windows NT 10.0) BotanicalReader/2.0')).toBe(false)
        expect(is_bot_user_agent('Mozilla/5.0 (Macintosh) Abbott/1.0')).toBe(false)
      })
    })
  })

  describe(is_bot_or_unknown_user_agent, () => {
    it('agrees with is_bot_user_agent on every present User-Agent', () => {
      for (const ua of [...BOTS, ...HUMANS])
        expect(is_bot_or_unknown_user_agent(ua)).toBe(is_bot_user_agent(ua))
    })

    it('fails CLOSED on a missing User-Agent (the 14.5 MB warm-up gate)', () => {
      expect(is_bot_or_unknown_user_agent(null)).toBe(true)
      expect(is_bot_or_unknown_user_agent('')).toBe(true)
    })
  })
}
