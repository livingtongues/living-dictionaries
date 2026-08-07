/**
 * THE uuid v4 minter for browser code. Use this everywhere in the client instead
 * of `crypto.randomUUID()` directly.
 *
 * WHY IT EXISTS. `crypto.randomUUID` is a 2021 API (Chrome 92, Safari 15.4,
 * Firefox 95). On 2026-08-06 a visitor in Ahmedabad on an Android 8.1 phone
 * running Chrome 87 opened an entry page and got a WHITE PAGE — the boot died on
 * `crypto.randomUUID is not a function` inside `remote-log.ts`, i.e. inside our
 * own telemetry, in the very first code that runs. On such a device the
 * leader-worker database was never going to work anyway, but there is a wide gulf
 * between *degraded* and *nothing at all*, and LD's audience skews to exactly
 * these phones. Found only because the boot-error reporter had shipped hours
 * earlier (2026-08-06 log review §1.2).
 *
 * The fallback ladder, in order:
 *   1. `crypto.randomUUID()` — the real thing, everywhere it exists.
 *   2. `crypto.getRandomValues()` (Chrome 11 / Safari 6.1 / IE 11) formatted as a
 *      v4 uuid — cryptographically strong, just hand-assembled.
 *   3. `Math.random()` — last-ditch, for a context with no WebCrypto at all
 *      (an insecure-origin/legacy embed). Weak, but our ids are row keys, not
 *      secrets, and a working page beats a blank one.
 *
 * SERVER code keeps calling `crypto.randomUUID()` directly: Node has had it
 * since 14.17 and there is no old-runtime axis there.
 */

const HEX: string[] = Array.from({ length: 256 }, (_, index) => (index + 0x100).toString(16).slice(1))

/** Format 16 random bytes as a v4 uuid (sets the version + variant bits in place). */
export function uuid_from_bytes(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0F) | 0x40
  bytes[8] = (bytes[8] & 0x3F) | 0x80
  return `${HEX[bytes[0]]}${HEX[bytes[1]]}${HEX[bytes[2]]}${HEX[bytes[3]]}-${HEX[bytes[4]]}${HEX[bytes[5]]}-${HEX[bytes[6]]}${HEX[bytes[7]]}-${HEX[bytes[8]]}${HEX[bytes[9]]}-${HEX[bytes[10]]}${HEX[bytes[11]]}${HEX[bytes[12]]}${HEX[bytes[13]]}${HEX[bytes[14]]}${HEX[bytes[15]]}`
}

export function new_uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      return crypto.randomUUID()
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function')
      return uuid_from_bytes(crypto.getRandomValues(new Uint8Array(16)))
  } catch {
    // A hardened/embedded context can throw on either call — fall through.
  }
  const bytes = new Uint8Array(16)
  for (let index = 0; index < 16; index++)
    bytes[index] = Math.floor(Math.random() * 256)
  return uuid_from_bytes(bytes)
}

if (import.meta.vitest) {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  describe(new_uuid, () => {
    test('mints a valid v4 uuid on a modern runtime', () => {
      expect(new_uuid()).toMatch(UUID_V4)
    })

    test('falls back to getRandomValues when randomUUID is absent (Chrome 87 / Android 8.1)', () => {
      const original = crypto.randomUUID
      // Simulating the old runtime (Chrome 87 has no `randomUUID`).
      ;(crypto as { randomUUID?: unknown }).randomUUID = undefined
      try {
        expect(new_uuid()).toMatch(UUID_V4)
      } finally {
        crypto.randomUUID = original
      }
    })

    test('falls back again when WebCrypto is missing entirely', () => {
      const original = globalThis.crypto
      // Simulating an insecure-origin context with no WebCrypto at all.
      delete (globalThis as { crypto?: Crypto }).crypto
      try {
        expect(new_uuid()).toMatch(UUID_V4)
      } finally {
        globalThis.crypto = original
      }
    })

    test('ids do not collide across a batch', () => {
      const ids = new Set(Array.from({ length: 1000 }, () => new_uuid()))
      expect(ids.size).toBe(1000)
    })
  })

  describe(uuid_from_bytes, () => {
    test('stamps the version and variant bits regardless of input', () => {
      expect(uuid_from_bytes(new Uint8Array(16))).toBe('00000000-0000-4000-8000-000000000000')
      expect(uuid_from_bytes(new Uint8Array(16).fill(0xFF))).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
    })
  })
}
