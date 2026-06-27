/**
 * Tiny dependency-free `user_agent` parser — enough to surface a browser / OS /
 * version breakdown in `/admin/analytics` and to flag the "can't run the local-DB
 * worker" cohort (Safari < 15.4 → no BroadcastChannel / Web Locks). We already
 * store the raw UA on every `client_logs` row, so this back-analyzes existing rows
 * with no schema migration. NOT a full UA-parsing library — just the families that
 * actually hit house, kept honest by the inline tests.
 *
 * Capability cutoff rationale (see `.issues/no-opfs-idb-fallback-tiers.md`):
 *   - BroadcastChannel + Web Locks: Safari 15.4 (the leader-worker DB needs both)
 *   - OPFS getDirectory: Safari 15.2 / sync-access-handles: 16.4
 * So Safari < 15.4 = main-thread-IDB-only (Tier 3); the dominant "old Mac" failure.
 */

export type DeviceType = 'desktop' | 'mobile' | 'tablet'

export interface ParsedUserAgent {
  /** 'Safari' | 'Chrome' | 'Edge' | 'Firefox' | 'Samsung Internet' | 'Opera' | 'Other' */
  browser: string
  /** Major version number, or null if unknown. */
  major: number | null
  /** Full version string as matched (e.g. '15.6'), or null. */
  version: string | null
  /** 'macOS' | 'iOS' | 'iPadOS' | 'Windows' | 'Android' | 'Linux' | 'ChromeOS' | 'Other' */
  os: string
  /** Marketing-ish OS version label (e.g. '18', '14', '10/11'), or null when the UA hides it. */
  os_version: string | null
  /** Coarse form factor inferred from the UA. */
  device: DeviceType
}

interface BrowserRule {
  name: string
  re: RegExp
}

// Order matters: more-specific UAs (Edge/Samsung/Opera embed "Chrome"/"Safari")
// must be tested BEFORE the generic Chrome/Safari rules.
const BROWSER_RULES: BrowserRule[] = [
  { name: 'Edge', re: /Edg(?:e|A|iOS)?\/(?<ver>\d+(?:\.\d+)?)/ },
  { name: 'Samsung Internet', re: /SamsungBrowser\/(?<ver>\d+(?:\.\d+)?)/ },
  { name: 'Opera', re: /OPR\/(?<ver>\d+(?:\.\d+)?)/ },
  { name: 'Firefox', re: /(?:Firefox|FxiOS)\/(?<ver>\d+(?:\.\d+)?)/ },
  // Chrome / Chromium (also covers CriOS = Chrome on iOS).
  { name: 'Chrome', re: /(?:Chrome|CriOS|Chromium)\/(?<ver>\d+(?:\.\d+)?)/ },
  // Safari LAST: its real version lives in `Version/x.y`, not the WebKit token.
  { name: 'Safari', re: /Version\/(?<ver>\d+(?:\.\d+)?) (?:Mobile\/\S+ )?Safari/ },
]

function detect_os(ua: string): string {
  if (/iPhone|iPod/.test(ua))
    return 'iOS'
  if (/iPad/.test(ua))
    return 'iPadOS'
  if (/Android/.test(ua))
    return 'Android'
  if (/CrOS/.test(ua))
    return 'ChromeOS'
  if (/Macintosh|Mac OS X/.test(ua))
    return 'macOS'
  if (/Windows/.test(ua))
    return 'Windows'
  if (/Linux/.test(ua))
    return 'Linux'
  return 'Other'
}

/**
 * Coarse form factor. iPhone/iPod → mobile; iPad → tablet; Android splits on the
 * `Mobile` token (phones carry it, tablets omit it); a bare `Mobile` token (rare
 * non-Android phones) → mobile; everything else → desktop. KNOWN GAP: iPadOS 13+
 * Safari ships a desktop "Macintosh" UA, so some iPads count as desktop.
 */
function detect_device({ ua, os }: { ua: string, os: string }): DeviceType {
  if (os === 'iOS')
    return 'mobile'
  if (os === 'iPadOS')
    return 'tablet'
  if (os === 'Android')
    return /Mobile/.test(ua) ? 'mobile' : 'tablet'
  if (/Mobile/.test(ua))
    return 'mobile'
  return 'desktop'
}

/**
 * Best-effort marketing OS version from the UA. iOS/iPadOS + Android expose a real
 * version; Windows only reveals the NT kernel (and NT 10.0 covers BOTH Win10 and
 * Win11 → labelled `10/11`); macOS is frozen at `10.15` for privacy on modern
 * Safari, so we surface the major only. Returns null when nothing usable is present.
 */
function detect_os_version({ ua, os }: { ua: string, os: string }): string | null {
  if (os === 'iOS' || os === 'iPadOS') {
    const match = ua.match(/OS (\d+)(?:_(\d+))?/)
    return match ? match[1] : null
  }
  if (os === 'Android') {
    const match = ua.match(/Android (\d+)(?:\.\d+)?/)
    return match ? match[1] : null
  }
  if (os === 'Windows') {
    const match = ua.match(/Windows NT (\d+\.\d+)/)
    if (!match)
      return null
    const NT_NAMES: Record<string, string> = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' }
    return NT_NAMES[match[1]] ?? `NT ${match[1]}`
  }
  if (os === 'macOS') {
    const match = ua.match(/Mac OS X (\d+)[._](\d+)/)
    return match ? `${match[1]}.${match[2]}` : null
  }
  return null
}

/**
 * Crawler / automated-agent detection. ~29% of house "sessions" are bots
 * (Applebot, Googlebot, GPTBot, …) — they have no OPFS/worker, never convert, and
 * polluted the analytics enough to send a `log-and-fix` chase down a false trail
 * (an Applebot `has_opfs:false` row read as "old Safari user"). Exclude them from
 * the human-facing browser/capability breakdown. Substring match on the common
 * tokens — cheap and good enough; UA bot-spoofing isn't a threat model here.
 */
const BOT_PATTERN = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|pinterest|whatsapp|telegrambot|headless|lighthouse|pagespeed|gptbot|chatgpt|claude|ccbot|perplexity|applebot|googlebot|yandex|baidu|duckduck|semrush|ahrefs|petalbot|dataforseo|python-requests|axios|curl|wget|node-fetch|go-http/i

export function is_bot_user_agent(ua: string | null | undefined): boolean {
  if (!ua)
    return false
  return BOT_PATTERN.test(ua)
}

export function parse_user_agent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua)
    return { browser: 'Other', major: null, version: null, os: 'Other', os_version: null, device: 'desktop' }

  const os = detect_os(ua)
  const os_version = detect_os_version({ ua, os })
  const device = detect_device({ ua, os })
  for (const rule of BROWSER_RULES) {
    const match = ua.match(rule.re)
    if (match) {
      const version = match.groups?.ver ?? null
      const major = version ? Number.parseInt(version, 10) : null
      return { browser: rule.name, major: Number.isNaN(major) ? null : major, version, os, os_version, device }
    }
  }
  return { browser: 'Other', major: null, version: null, os, os_version, device }
}

/**
 * True when the browser cannot run the leader-worker local DB (no BroadcastChannel
 * / Web Locks) → it's stuck on the main-thread IDB tier or the SSR floor. Today
 * the only meaningful population is Safari < 15.4 (incl. old iOS WebViews). Unknown
 * versions are treated as capable (don't over-warn).
 */
export function is_below_db_worker_capability(parsed: ParsedUserAgent): boolean {
  if (parsed.browser !== 'Safari')
    return false
  if (parsed.major === null)
    return false
  if (parsed.major < 15)
    return true
  if (parsed.major > 15)
    return false
  // Safari 15.x: need the minor — 15.4 is the BroadcastChannel/Web Locks cutoff.
  const minor = parsed.version ? Number.parseInt(parsed.version.split('.')[1] ?? '0', 10) : 0
  return (Number.isNaN(minor) ? 0 : minor) < 4
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe(parse_user_agent, () => {
    it('desktop Safari on Catalina (Wayne)', () => {
      const p = parse_user_agent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15')
      expect(p).toEqual({ browser: 'Safari', major: 15, version: '15.6', os: 'macOS', os_version: '10.15', device: 'desktop' })
    })

    it('iPhone Safari', () => {
      const p = parse_user_agent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1')
      expect(p).toEqual({ browser: 'Safari', major: 18, version: '18.5', os: 'iOS', os_version: '18', device: 'mobile' })
    })

    it('iPad Safari → tablet', () => {
      const p = parse_user_agent('Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1')
      expect(p).toMatchObject({ browser: 'Safari', os: 'iPadOS', os_version: '17', device: 'tablet' })
    })

    it('Chrome on Linux (Jacob dev)', () => {
      const p = parse_user_agent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36')
      expect(p).toEqual({ browser: 'Chrome', major: 148, version: '148.0', os: 'Linux', os_version: null, device: 'desktop' })
    })

    it('Chrome on Android phone → mobile, version extracted', () => {
      const p = parse_user_agent('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36')
      expect(p).toMatchObject({ browser: 'Chrome', os: 'Android', os_version: '10', device: 'mobile' })
    })

    it('Chrome on Android tablet (no Mobile token) → tablet', () => {
      const p = parse_user_agent('Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')
      expect(p).toMatchObject({ os: 'Android', os_version: '13', device: 'tablet' })
    })

    it('Edge is not misread as Chrome; Windows NT 10.0 → 10/11', () => {
      const p = parse_user_agent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0')
      expect(p).toMatchObject({ browser: 'Edge', os: 'Windows', os_version: '10/11', device: 'desktop' })
    })

    it('null / empty UA', () => {
      expect(parse_user_agent(null)).toEqual({ browser: 'Other', major: null, version: null, os: 'Other', os_version: null, device: 'desktop' })
    })
  })

  describe(is_bot_user_agent, () => {
    it('flags Applebot (the one that caused the false alarm)', () => {
      expect(is_bot_user_agent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)')).toBe(true)
    })
    it('flags Googlebot + GPTBot', () => {
      expect(is_bot_user_agent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true)
      expect(is_bot_user_agent('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.0; +https://openai.com/gptbot')).toBe(true)
    })
    it('does NOT flag a real Safari user', () => {
      expect(is_bot_user_agent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15')).toBe(false)
    })
    it('does NOT flag real Chrome', () => {
      expect(is_bot_user_agent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36')).toBe(false)
    })
  })

  describe(is_below_db_worker_capability, () => {
    it('Safari 15.6 is capable (≥15.4)', () => {
      expect(is_below_db_worker_capability(parse_user_agent('Version/15.6 Safari/605.1.15'))).toBe(false)
    })
    it('Safari 15.2 is BELOW (no BroadcastChannel)', () => {
      expect(is_below_db_worker_capability({ browser: 'Safari', major: 15, version: '15.2', os: 'macOS', os_version: '10.15', device: 'desktop' })).toBe(true)
    })
    it('Safari 14 is BELOW', () => {
      expect(is_below_db_worker_capability({ browser: 'Safari', major: 14, version: '14.1', os: 'macOS', os_version: '10.15', device: 'desktop' })).toBe(true)
    })
    it('Chrome is never flagged', () => {
      expect(is_below_db_worker_capability({ browser: 'Chrome', major: 100, version: '100.0', os: 'Linux', os_version: null, device: 'desktop' })).toBe(false)
    })
  })
}
