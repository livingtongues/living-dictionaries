import type { MediaTimings } from '$lib/db/schemas/dictionary.types'
import type { TokenSpan } from './media-timings'
import { build_text_timings, encode_token_spans } from './media-timings'

/** Editor spans keyed by sentence id — absolute ms, mutated by drags, re-encoded on save. */
export type SpansBySentence = Record<string, (TokenSpan | undefined)[]>

const MIN_DURATION_MS = 20 // one CTC frame — the aligner's own resolution floor

export function init_editor_spans({ ordered_sentence_ids, timings }: {
  ordered_sentence_ids: string[]
  timings: MediaTimings | null | undefined
}): SpansBySentence {
  const spans: SpansBySentence = {}
  const map = build_text_timings({ ordered_sentence_ids, timings })
  for (const [sentence_id, timing] of map)
    spans[sentence_id] = timing.token_spans.map(span => span ? { ...span } : undefined)
  return spans
}

/**
 * Clamp a dragged edge: a token can't shrink below one CTC frame, cross its
 * sentence-neighbor tokens, or (for the outermost tokens) cross into the
 * previous/next sentence's timed material or outside the clip.
 */
export function clamp_edge({ token_spans, index, edge, to_ms, floor_ms, ceiling_ms }: {
  token_spans: (TokenSpan | undefined)[]
  index: number
  edge: 'start' | 'end'
  to_ms: number
  /** End of the last timed token before this sentence (or 0). */
  floor_ms: number
  /** Start of the first timed token after this sentence (or clip duration). */
  ceiling_ms: number
}): number {
  const span = token_spans[index]
  if (!span)
    return to_ms

  let previous_end = floor_ms
  for (let i = index - 1; i >= 0; i--) {
    const neighbor = token_spans[i]
    if (neighbor) {
      previous_end = neighbor.end_ms
      break
    }
  }
  let next_start = ceiling_ms
  for (let i = index + 1; i < token_spans.length; i++) {
    const neighbor = token_spans[i]
    if (neighbor) {
      next_start = neighbor.start_ms
      break
    }
  }

  if (edge === 'start')
    return Math.min(Math.max(to_ms, previous_end), span.end_ms - MIN_DURATION_MS)
  return Math.max(Math.min(to_ms, next_start), span.start_ms + MIN_DURATION_MS)
}

/**
 * Re-encode every sentence's timing string with the chained cursor — the
 * inverse of `init_editor_spans`. Original entries for ids OUTSIDE the ordered
 * list (stale/unknown) are preserved untouched; ordered sentences without
 * editor spans (never timed) stay absent, matching decode's skip behavior.
 */
export function encode_all_timings({ ordered_sentence_ids, spans_by_sentence, original_timings }: {
  ordered_sentence_ids: string[]
  spans_by_sentence: SpansBySentence
  original_timings: MediaTimings | null | undefined
}): MediaTimings {
  const result: MediaTimings = {}
  const ordered_set = new Set<string>(ordered_sentence_ids)
  for (const [sentence_id, timing_string] of Object.entries(original_timings ?? {})) {
    if (!ordered_set.has(sentence_id))
      result[sentence_id] = timing_string
  }
  let cursor_ms = 0
  for (const sentence_id of ordered_sentence_ids) {
    const token_spans = spans_by_sentence[sentence_id]
    if (!token_spans)
      continue
    const encoded = encode_token_spans({ token_spans, cursor_ms })
    result[sentence_id] = encoded.timing_string
    ;({ cursor_ms } = encoded)
  }
  return result
}

if (import.meta.vitest) {
  const timings = { s1: '0,100|0,100', s2: '50,200|' }

  describe(init_editor_spans, () => {
    test('decodes to absolute spans, chaining across sentences', () => {
      const spans = init_editor_spans({ ordered_sentence_ids: ['s1', 's2'], timings })
      expect(spans.s1).toEqual([{ start_ms: 0, end_ms: 100 }, { start_ms: 100, end_ms: 200 }])
      expect(spans.s2).toEqual([{ start_ms: 250, end_ms: 450 }, undefined])
    })
  })

  describe(encode_all_timings, () => {
    test('round-trips unedited spans byte-identically', () => {
      const spans = init_editor_spans({ ordered_sentence_ids: ['s1', 's2'], timings })
      expect(encode_all_timings({ ordered_sentence_ids: ['s1', 's2'], spans_by_sentence: spans, original_timings: timings }))
        .toEqual(timings)
    })

    test('an edit reflows the following sentence offsets', () => {
      const spans = init_editor_spans({ ordered_sentence_ids: ['s1', 's2'], timings })
      spans.s1[1].end_ms = 150 // shorten the last word of s1
      const encoded = encode_all_timings({ ordered_sentence_ids: ['s1', 's2'], spans_by_sentence: spans, original_timings: timings })
      expect(encoded.s1).toBe('0,100|0,50')
      // s2's word still starts at absolute 250 — offset grows from 50 to 100.
      expect(encoded.s2).toBe('100,200|')
    })

    test('preserves entries for ids outside the ordered list', () => {
      const with_stale = { ...timings, stale: '1,2' }
      const spans = init_editor_spans({ ordered_sentence_ids: ['s1', 's2'], timings: with_stale })
      const encoded = encode_all_timings({ ordered_sentence_ids: ['s1', 's2'], spans_by_sentence: spans, original_timings: with_stale })
      expect(encoded.stale).toBe('1,2')
    })
  })

  describe(clamp_edge, () => {
    const token_spans = [
      { start_ms: 0, end_ms: 100 },
      undefined,
      { start_ms: 150, end_ms: 300 },
    ]

    test('start edge clamps to the previous timed neighbor and its own end', () => {
      expect(clamp_edge({ token_spans, index: 2, edge: 'start', to_ms: 50, floor_ms: 0, ceiling_ms: 1000 })).toBe(100)
      expect(clamp_edge({ token_spans, index: 2, edge: 'start', to_ms: 500, floor_ms: 0, ceiling_ms: 1000 })).toBe(280)
      expect(clamp_edge({ token_spans, index: 2, edge: 'start', to_ms: 120, floor_ms: 0, ceiling_ms: 1000 })).toBe(120)
    })

    test('end edge clamps to the next timed neighbor / ceiling and its own start', () => {
      expect(clamp_edge({ token_spans, index: 0, edge: 'end', to_ms: 200, floor_ms: 0, ceiling_ms: 1000 })).toBe(150)
      expect(clamp_edge({ token_spans, index: 0, edge: 'end', to_ms: -50, floor_ms: 0, ceiling_ms: 1000 })).toBe(20)
      expect(clamp_edge({ token_spans, index: 2, edge: 'end', to_ms: 2000, floor_ms: 0, ceiling_ms: 1000 })).toBe(1000)
    })

    test('first token start respects the previous sentence floor', () => {
      expect(clamp_edge({ token_spans, index: 0, edge: 'start', to_ms: -100, floor_ms: 40, ceiling_ms: 1000 })).toBe(40)
    })
  })
}
