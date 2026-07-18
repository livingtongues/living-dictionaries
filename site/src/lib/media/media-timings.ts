import type { MediaTimings } from '$lib/db/schemas/dictionary.types'

/**
 * Karaoke word-timing utilities for the compact `MediaTimings` string format
 * (`"offset,duration|offset,duration|…"`, ported from tutor's parse-words).
 *
 * Each pipe-delimited part is one token: `offset` is milliseconds from the END
 * of the previous TIMED token (so the cursor chains ACROSS sentences for a
 * continuous text-level clip), `duration` is the token's length in ms. An empty
 * part is an untimed token (e.g. punctuation) and advances nothing.
 */

/** Absolute ms span of one timed token within a media clip. */
export interface TokenSpan {
  start_ms: number
  end_ms: number
}

export interface UnpackResult {
  /** One entry per pipe part; `undefined` for untimed (empty) parts. */
  spans: (TokenSpan | undefined)[]
  /** Cursor position after this string — feed into the next sentence to chain. */
  cursor_ms: number
}

/** Unpack ONE sentence's timing string into absolute spans, chaining from `cursor_ms`. */
export function unpack_timing_string({ timing_string, cursor_ms }: {
  timing_string: string
  cursor_ms: number
}): UnpackResult {
  const spans: (TokenSpan | undefined)[] = []
  let cursor = cursor_ms
  for (const part of timing_string.split('|')) {
    if (!part) {
      spans.push(undefined)
      continue
    }
    const [offset, duration] = part.split(',').map(Number)
    const start_ms = cursor + offset
    const end_ms = start_ms + duration
    spans.push({ start_ms, end_ms })
    cursor = end_ms
  }
  return { spans, cursor_ms: cursor }
}

/** Absolute timing for one sentence, ready to drive karaoke + seek. */
export interface SentenceTiming {
  /** Start of the first timed token; `null` when the sentence has no timed tokens. */
  start_ms: number | null
  /** End of the last timed token; `null` when the sentence has no timed tokens. */
  end_ms: number | null
  /** Per-token spans (index-aligned to `tokens.default`); `undefined` = untimed. */
  token_spans: (TokenSpan | undefined)[]
}

/**
 * Unpack a whole text's `MediaTimings` into absolute per-sentence spans. Walks
 * `ordered_sentence_ids` in reading order so the cursor chains across sentences;
 * ids absent from `timings` contribute nothing and leave the cursor untouched.
 */
export function build_text_timings({ ordered_sentence_ids, timings }: {
  ordered_sentence_ids: string[]
  timings: MediaTimings | null | undefined
}): Map<string, SentenceTiming> {
  const result = new Map<string, SentenceTiming>()
  if (!timings)
    return result
  let cursor_ms = 0
  for (const sentence_id of ordered_sentence_ids) {
    const timing_string = timings[sentence_id]
    if (typeof timing_string !== 'string' || !timing_string)
      continue
    const { spans, cursor_ms: next } = unpack_timing_string({ timing_string, cursor_ms })
    cursor_ms = next
    const timed = spans.filter((span): span is TokenSpan => !!span)
    result.set(sentence_id, {
      start_ms: timed.length ? timed[0].start_ms : null,
      end_ms: timed.length ? timed[timed.length - 1].end_ms : null,
      token_spans: spans,
    })
  }
  return result
}

/**
 * Index of the token whose span contains `current_ms` (the highlighted word), or
 * -1 when none is active. Untimed (`undefined`) spans never match.
 */
export function find_active_token({ token_spans, current_ms }: {
  token_spans: (TokenSpan | undefined)[]
  current_ms: number
}): number {
  for (let i = 0; i < token_spans.length; i++) {
    const span = token_spans[i]
    if (span && current_ms >= span.start_ms && current_ms < span.end_ms)
      return i
  }
  return -1
}

if (import.meta.vitest) {
  describe(unpack_timing_string, () => {
    test('unpacks offsets/durations from a zero cursor', () => {
      const { spans, cursor_ms } = unpack_timing_string({ timing_string: '0,100|50,200', cursor_ms: 0 })
      expect(spans).toEqual([
        { start_ms: 0, end_ms: 100 },
        { start_ms: 150, end_ms: 350 },
      ])
      expect(cursor_ms).toBe(350)
    })

    test('empty parts are untimed and do not advance the cursor', () => {
      const { spans, cursor_ms } = unpack_timing_string({ timing_string: '0,100||10,50', cursor_ms: 0 })
      expect(spans).toEqual([
        { start_ms: 0, end_ms: 100 },
        undefined,
        { start_ms: 110, end_ms: 160 },
      ])
      expect(cursor_ms).toBe(160)
    })

    test('chains from a non-zero cursor', () => {
      const { spans } = unpack_timing_string({ timing_string: '0,100', cursor_ms: 1000 })
      expect(spans).toEqual([{ start_ms: 1000, end_ms: 1100 }])
    })
  })

  describe(build_text_timings, () => {
    test('chains the cursor across sentences in reading order', () => {
      const map = build_text_timings({
        ordered_sentence_ids: ['s1', 's2'],
        timings: { s1: '0,100|0,100', s2: '0,200' },
      })
      expect(map.get('s1')).toEqual({
        start_ms: 0,
        end_ms: 200,
        token_spans: [{ start_ms: 0, end_ms: 100 }, { start_ms: 100, end_ms: 200 }],
      })
      // s2 chains from s1's end (200), NOT from zero.
      expect(map.get('s2')).toEqual({
        start_ms: 200,
        end_ms: 400,
        token_spans: [{ start_ms: 200, end_ms: 400 }],
      })
    })

    test('skips sentences with no timing entry but keeps the cursor', () => {
      const map = build_text_timings({
        ordered_sentence_ids: ['s1', 'gap', 's2'],
        timings: { s1: '0,100', s2: '0,100' },
      })
      expect(map.has('gap')).toBe(false)
      expect(map.get('s2')?.start_ms).toBe(100)
    })

    test('leading untimed tokens do not become the sentence start', () => {
      const map = build_text_timings({
        ordered_sentence_ids: ['s1'],
        timings: { s1: '|0,100|' },
      })
      expect(map.get('s1')).toEqual({
        start_ms: 0,
        end_ms: 100,
        token_spans: [undefined, { start_ms: 0, end_ms: 100 }, undefined],
      })
    })

    test('null timings → empty map', () => {
      expect(build_text_timings({ ordered_sentence_ids: ['s1'], timings: null }).size).toBe(0)
    })
  })

  describe(find_active_token, () => {
    const token_spans = [
      { start_ms: 0, end_ms: 100 },
      undefined,
      { start_ms: 100, end_ms: 200 },
    ]
    test('finds the containing token (start inclusive, end exclusive)', () => {
      expect(find_active_token({ token_spans, current_ms: 0 })).toBe(0)
      expect(find_active_token({ token_spans, current_ms: 99 })).toBe(0)
      expect(find_active_token({ token_spans, current_ms: 100 })).toBe(2)
      expect(find_active_token({ token_spans, current_ms: 199 })).toBe(2)
    })
    test('returns -1 when nothing is active', () => {
      expect(find_active_token({ token_spans, current_ms: 200 })).toBe(-1)
      expect(find_active_token({ token_spans, current_ms: -1 })).toBe(-1)
    })
  })
}
