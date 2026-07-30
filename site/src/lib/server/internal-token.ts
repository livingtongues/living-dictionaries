import { randomBytes, timingSafeEqual } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The shared secret that lets something already ON THE BOX call a loopback-only
 * internal endpoint (today: `POST /api/internal/system-chat`).
 *
 * SELF-PROVISIONED ON PURPOSE. The obvious alternative — an env var in
 * `vps-setup/secrets-decrypted/sveltekit-*.env` — would mean every internal
 * endpoint needs a secrets edit, a `bin/sync`, and a machine that holds the
 * decryption password (mustang deliberately does not). Generating the token into
 * the data volume instead means the box provisions itself on first boot, the
 * agent reads the same file it already has root on, and rotation is
 * `rm .internal-api-token` + a restart.
 *
 * It lives at `${DATA_DIR}/.internal-api-token`, which is NOT web-reachable:
 * Caddy only mounts the `files/` and `updates/` SUBdirectories of the data
 * volume, never its root.
 *
 * Blue and green share one DATA_DIR and boot seconds apart, so creation is
 * atomic (`wx` — exclusive create) and a loser just reads what the winner wrote.
 */

const TOKEN_FILE = '.internal-api-token'

/** Resolved per call, never captured: `DATA_DIR` can change after module init (tests). */
function token_path(): string {
  const dir = process.env.DATA_DIR || '.data'
  return join(dir, TOKEN_FILE)
}

/**
 * The box's internal token, creating it if this is the first boot. Returns null
 * only if the data volume is unwritable AND unreadable — in which case every
 * internal endpoint must fail closed rather than fall open.
 */
export function read_or_create_internal_token(): string | null {
  const path = token_path()
  try {
    return readFileSync(path, 'utf8').trim() || null
  } catch {
    // Not there yet — try to be the one that creates it.
  }
  const token = randomBytes(32).toString('hex')
  try {
    mkdirSync(process.env.DATA_DIR || '.data', { recursive: true })
    // 'wx' = create-or-fail, so two containers racing can't both win.
    writeFileSync(path, `${token}\n`, { flag: 'wx', mode: 0o600 })
    chmodSync(path, 0o600)
    return token
  } catch {
    // Lost the race (or can't write): the winner's token is the real one.
    try {
      return readFileSync(path, 'utf8').trim() || null
    } catch {
      return null
    }
  }
}

/**
 * Constant-time check of a caller-supplied token.
 *
 * Fails closed on a missing/short/absent token — an internal endpoint with no
 * provisioned secret must reject everything, never accept everything.
 */
export function internal_token_matches(presented: string | null | undefined): boolean {
  if (!presented)
    return false
  const expected = read_or_create_internal_token()
  if (!expected)
    return false
  const a = Buffer.from(presented)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch; compare lengths first (the length
  // of a hex token is not a secret).
  if (a.length !== b.length)
    return false
  return timingSafeEqual(a, b)
}

/**
 * True when the request came through Caddy rather than straight to the loopback
 * port. Belt-and-braces beside the token: the app is proxied for the whole
 * public internet, so `/api/internal/*` IS publicly routable, and this makes a
 * leaked token still useless from outside the box. Caddy's `reverse_proxy` always
 * sets `X-Forwarded-For`, and it APPENDS, so a caller cannot strip it.
 */
export function came_through_proxy(headers: Headers): boolean {
  return headers.has('x-forwarded-for') || headers.has('cf-connecting-ip')
}

if (import.meta.vitest) {
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')

  let dir: string
  let previous: string | undefined

  beforeEach(() => {
    previous = process.env.DATA_DIR
    dir = mkdtempSync(join(tmpdir(), 'ld-internal-token-'))
    process.env.DATA_DIR = dir
  })
  afterEach(() => {
    if (previous === undefined)
      delete process.env.DATA_DIR
    else
      process.env.DATA_DIR = previous
    rmSync(dir, { recursive: true, force: true })
  })

  describe(read_or_create_internal_token, () => {
    test('creates once and is stable across calls (both containers agree)', () => {
      const first = read_or_create_internal_token()
      expect(first).toMatch(/^[0-9a-f]{64}$/)
      expect(read_or_create_internal_token()).toBe(first)
    })

    test('an unwritable data dir yields null rather than a fresh token each call', () => {
      process.env.DATA_DIR = join(dir, 'not-a-dir-its-a-file')
      writeFileSync(process.env.DATA_DIR, 'x')
      expect(read_or_create_internal_token()).toBe(null)
    })
  })

  describe(internal_token_matches, () => {
    test('accepts the real token and rejects everything else', () => {
      const token = read_or_create_internal_token()!
      expect(internal_token_matches(token)).toBe(true)
      expect(internal_token_matches(`${token}x`)).toBe(false)
      expect(internal_token_matches('')).toBe(false)
      expect(internal_token_matches(null)).toBe(false)
      expect(internal_token_matches(undefined)).toBe(false)
    })

    test('fails CLOSED when no token can be provisioned', () => {
      process.env.DATA_DIR = join(dir, 'file-not-dir')
      writeFileSync(process.env.DATA_DIR, 'x')
      expect(internal_token_matches('anything')).toBe(false)
    })
  })

  describe(came_through_proxy, () => {
    test('spots a proxied request, passes a direct loopback one', () => {
      expect(came_through_proxy(new Headers({ 'x-forwarded-for': '1.2.3.4' }))).toBe(true)
      expect(came_through_proxy(new Headers({ 'cf-connecting-ip': '1.2.3.4' }))).toBe(true)
      expect(came_through_proxy(new Headers({ 'content-type': 'application/json' }))).toBe(false)
    })
  })
}
