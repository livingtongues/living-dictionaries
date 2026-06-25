/**
 * Time/date formatting helpers shared across admin pages. Three flavors:
 *
 *   format_relative_time(iso) — "just now" / "X minutes ago" / "X hours ago" /
 *                                "yesterday" / "X days ago" / "X weeks ago" /
 *                                "Mon D" / "Mon D YYYY" for older dates.
 *                                Used in lists and per-message stamps where
 *                                friendly prose beats a precise locale string.
 *
 *   format_date_time(iso)     — full `toLocaleString()` ("5/19/2026, 10:00:00 AM").
 *                                Used in detail views (and as a `title` hover
 *                                tooltip alongside the relative stamp) where
 *                                exact time matters.
 *
 *   format_date(iso)          — `toLocaleDateString()` ("5/19/2026").
 *                                Used for "joined" stamps + date-only displays.
 *
 * All three accept ISO strings or Dates. Empty/null/undefined → empty string
 * (callers can use it in `{format_x(maybe_null)}` without guarding).
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Compact date label for chart tooltips/axes from a 'YYYY-MM-DD' or 'YYYY-MM'
 * string: "Mar 7, 2020" (full) or "Mar 2020" (month-only). Parses the string
 * parts directly (no timezone shift), unlike the Date-based helpers above.
 */
export function format_point_date(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const name = MONTHS[(month || 1) - 1]
  return day ? `${name} ${day}, ${year}` : `${name} ${year}`
}

export function format_relative_time(iso: string | Date | null | undefined): string {
  if (!iso)
    return ''
  const date = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(date.getTime()))
    return 'invalid date'

  const now = new Date()
  const diff_sec = Math.floor((now.getTime() - date.getTime()) / 1000)

  // Future dates → treat as "just now"
  if (diff_sec < 60)
    return 'just now'

  const diff_min = Math.floor(diff_sec / 60)
  if (diff_min < 60)
    return `${diff_min} minute${diff_min === 1 ? '' : 's'} ago`

  const diff_hours = Math.floor(diff_min / 60)
  if (diff_hours < 24)
    return `${diff_hours} hour${diff_hours === 1 ? '' : 's'} ago`

  const diff_days = Math.floor(diff_hours / 24)
  if (diff_days === 1)
    return 'yesterday'
  if (diff_days < 7)
    return `${diff_days} days ago`

  if (diff_days < 30) {
    const weeks = Math.floor(diff_days / 7)
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  }

  const day = date.getDate()
  const month = MONTHS[date.getMonth()]
  const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`
  return `${month} ${day}${year}`
}

export function format_date_time(iso: string | Date | null | undefined): string {
  if (!iso)
    return ''
  const date = iso instanceof Date ? iso : new Date(iso)
  return date.toLocaleString()
}

export function format_date(iso: string | Date | null | undefined): string {
  if (!iso)
    return ''
  const date = iso instanceof Date ? iso : new Date(iso)
  return date.toLocaleDateString()
}

if (import.meta.vitest) {
  describe(format_relative_time, () => {
    // Freeze time so the relative-math tests are deterministic.
    const MOCK_NOW = new Date('2026-05-20T12:00:00.000Z')
    vi.setSystemTime(MOCK_NOW)

    test('empty input returns empty string', () => {
      expect(format_relative_time(null)).toBe('')
      expect(format_relative_time(undefined)).toBe('')
      expect(format_relative_time('')).toBe('')
    })

    test('invalid date string', () => {
      expect(format_relative_time('bad-date')).toBe('invalid date')
    })

    test('within last minute → "just now"', () => {
      expect(format_relative_time(new Date(MOCK_NOW.getTime() - 30_000))).toBe('just now')
    })

    test('future dates → "just now"', () => {
      expect(format_relative_time(new Date(MOCK_NOW.getTime() + 100_000))).toBe('just now')
    })

    test('minutes ago (singular vs plural)', () => {
      expect(format_relative_time(new Date(MOCK_NOW.getTime() - 60_000))).toBe('1 minute ago')
      expect(format_relative_time(new Date(MOCK_NOW.getTime() - 30 * 60_000))).toBe('30 minutes ago')
      expect(format_relative_time(new Date(MOCK_NOW.getTime() - 59 * 60_000))).toBe('59 minutes ago')
    })

    test('hours ago (singular vs plural)', () => {
      expect(format_relative_time(new Date(MOCK_NOW.getTime() - 60 * 60_000))).toBe('1 hour ago')
      expect(format_relative_time(new Date(MOCK_NOW.getTime() - 3 * 60 * 60_000))).toBe('3 hours ago')
    })

    test('yesterday', () => {
      const yesterday = new Date(MOCK_NOW)
      yesterday.setDate(yesterday.getDate() - 1)
      expect(format_relative_time(yesterday)).toBe('yesterday')
    })

    test('days ago', () => {
      expect(format_relative_time(new Date(MOCK_NOW.getTime() - 3 * 24 * 60 * 60_000))).toBe('3 days ago')
    })

    test('weeks ago', () => {
      expect(format_relative_time(new Date(MOCK_NOW.getTime() - 7 * 24 * 60 * 60_000))).toBe('1 week ago')
      expect(format_relative_time(new Date(MOCK_NOW.getTime() - 14 * 24 * 60 * 60_000))).toBe('2 weeks ago')
    })

    test('older than 30 days → month/day (same year)', () => {
      expect(format_relative_time(new Date('2026-01-15T12:00:00Z'))).toBe('Jan 15')
    })

    test('older than 30 days, prior year → month/day with year', () => {
      expect(format_relative_time(new Date('2024-12-25T12:00:00Z'))).toBe('Dec 25 2024')
    })

    test('accepts Date objects directly', () => {
      const date = new Date(MOCK_NOW.getTime() - 30_000)
      expect(format_relative_time(date)).toBe('just now')
    })
  })

  describe(format_date_time, () => {
    test('renders a full datetime string', () => {
      const result = format_date_time('2026-05-19T10:00:00.000Z')
      expect(result.length).toBeGreaterThan(0)
      expect(result).toContain('2026')
    })

    test('empty input → empty string', () => {
      expect(format_date_time(null)).toBe('')
    })
  })

  describe(format_date, () => {
    test('renders date only', () => {
      const result = format_date('2026-05-19T10:00:00.000Z')
      expect(result.length).toBeGreaterThan(0)
      // No time component (no colon)
      expect(result).not.toContain(':')
    })

    test('empty input → empty string', () => {
      expect(format_date(undefined)).toBe('')
    })
  })
}
