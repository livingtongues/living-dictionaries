/**
 * Minimal single-range `Range: bytes=…` parser for byte-serving media.
 *
 * Media elements need 206 responses to seek — Chrome degrades to
 * play-from-the-start-only without them and Safari refuses to play at all — so
 * any endpoint streaming video/audio has to honour this header.
 *
 * Multi-range requests (`bytes=0-99,200-299`) are not supported; browsers don't
 * send them for media playback. We return `null` for those and for anything
 * malformed, which callers treat as "serve the whole object" (a 200), exactly
 * as RFC 9110 permits for an unsatisfiable-but-ignorable range.
 */

export interface ByteRange {
  /** First byte position, inclusive. */
  start: number
  /** Last byte position, inclusive. */
  end: number
}

export function parse_range_header({ range, total_size }: { range: string | null, total_size: number }): ByteRange | 'unsatisfiable' | null {
  if (!range || total_size <= 0)
    return null
  const match = /^bytes=(?<start>\d*)-(?<end>\d*)$/.exec(range.trim())
  if (!match?.groups)
    return null
  const { start: raw_start, end: raw_end } = match.groups
  if (!raw_start && !raw_end)
    return null

  // `bytes=-500` — the final 500 bytes.
  if (!raw_start) {
    const suffix_length = Number(raw_end)
    if (!suffix_length)
      return 'unsatisfiable'
    return { start: Math.max(total_size - suffix_length, 0), end: total_size - 1 }
  }

  const start = Number(raw_start)
  if (start >= total_size)
    return 'unsatisfiable'
  const end = raw_end ? Math.min(Number(raw_end), total_size - 1) : total_size - 1
  if (end < start)
    return 'unsatisfiable'
  return { start, end }
}

/** The `Content-Range` value for a satisfied partial response. */
export function content_range_header({ range, total_size }: { range: ByteRange, total_size: number }): string {
  return `bytes ${range.start}-${range.end}/${total_size}`
}

if (import.meta.vitest) {
  describe(parse_range_header, () => {
    const total_size = 1000

    it('parses an open-ended range (what a media element sends first)', () => {
      expect(parse_range_header({ range: 'bytes=0-', total_size })).toEqual({ start: 0, end: 999 })
    })

    it('parses a closed range and clamps the end to the last byte', () => {
      expect(parse_range_header({ range: 'bytes=200-499', total_size })).toEqual({ start: 200, end: 499 })
      expect(parse_range_header({ range: 'bytes=900-5000', total_size })).toEqual({ start: 900, end: 999 })
    })

    it('parses a suffix range', () => {
      expect(parse_range_header({ range: 'bytes=-500', total_size })).toEqual({ start: 500, end: 999 })
      expect(parse_range_header({ range: 'bytes=-5000', total_size })).toEqual({ start: 0, end: 999 })
    })

    it('reports unsatisfiable ranges', () => {
      expect(parse_range_header({ range: 'bytes=1000-', total_size })).toBe('unsatisfiable')
      expect(parse_range_header({ range: 'bytes=500-400', total_size })).toBe('unsatisfiable')
      expect(parse_range_header({ range: 'bytes=-0', total_size })).toBe('unsatisfiable')
    })

    it('returns null for absent, malformed, multi-range, or unknown-size requests', () => {
      expect(parse_range_header({ range: null, total_size })).toBe(null)
      expect(parse_range_header({ range: 'items=0-10', total_size })).toBe(null)
      expect(parse_range_header({ range: 'bytes=0-99,200-299', total_size })).toBe(null)
      expect(parse_range_header({ range: 'bytes=-', total_size })).toBe(null)
      expect(parse_range_header({ range: 'bytes=0-', total_size: 0 })).toBe(null)
    })
  })

  describe(content_range_header, () => {
    it('formats the header', () => {
      expect(content_range_header({ range: { start: 200, end: 499 }, total_size: 1000 })).toBe('bytes 200-499/1000')
    })
  })
}
