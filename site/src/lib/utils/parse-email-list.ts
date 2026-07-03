/** Loose but practical single-address check for admin compose/reply fields. */
export function looks_like_email(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes(' '))
    return false
  const at = trimmed.lastIndexOf('@')
  if (at <= 0 || at >= trimmed.length - 1)
    return false
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  return local.length > 0 && domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.')
}

/**
 * Parse comma/semicolon-separated admin CC/BCC input into normalized addresses.
 * Returns `{ emails, error }` — error is a human-readable validation message.
 */
export function parse_email_list(raw: string | undefined | null): { emails: string[], error: string | null } {
  const text = raw?.trim() ?? ''
  if (!text)
    return { emails: [], error: null }

  const parts = text.split(/[,;]+/).map(part => part.trim()).filter(Boolean)
  if (parts.length === 0)
    return { emails: [], error: null }

  const emails: string[] = []
  for (const part of parts) {
    if (!looks_like_email(part))
      return { emails: [], error: `Invalid email address: ${part}` }
    emails.push(part.toLowerCase())
  }
  return { emails, error: null }
}

if (import.meta.vitest) {
  describe(looks_like_email, () => {
    test('accepts normal addresses', () => {
      expect(looks_like_email('alice@example.com')).toBe(true)
      expect(looks_like_email(' jacob@livingdictionaries.app ')).toBe(true)
    })

    test('rejects malformed addresses', () => {
      expect(looks_like_email('not-an-email')).toBe(false)
      expect(looks_like_email('a@b')).toBe(false)
      expect(looks_like_email('a b@c.com')).toBe(false)
    })
  })

  describe(parse_email_list, () => {
    test('returns empty for blank input', () => {
      expect(parse_email_list('')).toEqual({ emails: [], error: null })
      expect(parse_email_list('  ')).toEqual({ emails: [], error: null })
    })

    test('parses comma and semicolon separators', () => {
      expect(parse_email_list('a@x.com, b@y.com; c@z.com')).toEqual({
        emails: ['a@x.com', 'b@y.com', 'c@z.com'],
        error: null,
      })
    })

    test('normalizes to lowercase', () => {
      expect(parse_email_list('Anna@LivingDictionaries.app')).toEqual({
        emails: ['anna@livingdictionaries.app'],
        error: null,
      })
    })

    test('returns error for invalid token', () => {
      expect(parse_email_list('good@x.com, bad')).toEqual({
        emails: [],
        error: 'Invalid email address: bad',
      })
    })
  })
}
