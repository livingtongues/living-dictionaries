/**
 * Hard-block recipients we should never send to: bounce daemons, no-reply
 * accounts, postmaster mailboxes, RFC 2606 reserved domains. "Level 1" loop
 * protection — deeper spam/auto-response classification on inbound is the
 * future triage agent's job.
 */
const BLOCKED_LOCAL_PARTS = [
  'noreply',
  'no-reply',
  'mailer-daemon',
  'postmaster',
  'do-not-reply',
  'donotreply',
]

const BLOCKED_DOMAIN_SUFFIXES = [
  '.invalid', // RFC 2606
  '.local',
  '.localhost',
  '.test',
]

export function is_blocked_recipient(email: string): boolean {
  const lower = email.trim().toLowerCase()
  const at = lower.lastIndexOf('@')
  if (at === -1)
    return true // malformed
  const local = lower.slice(0, at)
  const domain = lower.slice(at + 1)

  if (BLOCKED_LOCAL_PARTS.includes(local))
    return true
  for (const suffix of BLOCKED_DOMAIN_SUFFIXES) {
    if (domain.endsWith(suffix))
      return true
  }
  return false
}

if (import.meta.vitest) {
  describe(is_blocked_recipient, () => {
    test('blocks noreply@', () => {
      expect(is_blocked_recipient('noreply@gmail.com')).toBe(true)
    })

    test('blocks no-reply@', () => {
      expect(is_blocked_recipient('no-reply@google.com')).toBe(true)
    })

    test('blocks mailer-daemon@', () => {
      expect(is_blocked_recipient('mailer-daemon@anywhere.com')).toBe(true)
    })

    test('blocks postmaster@', () => {
      expect(is_blocked_recipient('postmaster@bigco.com')).toBe(true)
    })

    test('blocks do-not-reply and donotreply variants', () => {
      expect(is_blocked_recipient('do-not-reply@example.com')).toBe(true)
      expect(is_blocked_recipient('donotreply@example.com')).toBe(true)
    })

    test('blocks .invalid domain (RFC 2606)', () => {
      expect(is_blocked_recipient('someone@somewhere.invalid')).toBe(true)
    })

    test('blocks .local and .test reserved domains', () => {
      expect(is_blocked_recipient('user@host.local')).toBe(true)
      expect(is_blocked_recipient('user@host.test')).toBe(true)
    })

    test('blocks malformed addresses (no @)', () => {
      expect(is_blocked_recipient('not-an-email')).toBe(true)
    })

    test('is case-insensitive', () => {
      expect(is_blocked_recipient('NoReply@Gmail.com')).toBe(true)
      expect(is_blocked_recipient('  NOREPLY@example.com  ')).toBe(true)
    })

    test('allows normal addresses', () => {
      expect(is_blocked_recipient('alice@example.com')).toBe(false)
      expect(is_blocked_recipient('customer@gmail.com')).toBe(false)
      expect(is_blocked_recipient('diego@livingtongues.org')).toBe(false)
    })

    test('local-part is exact match (does not over-block "noreplyish@" etc.)', () => {
      expect(is_blocked_recipient('noreplyish@example.com')).toBe(false)
      expect(is_blocked_recipient('postmaster.aux@example.com')).toBe(false)
    })
  })
}
