export interface CaretInsertion {
  value: string
  /** Where the caret belongs after the insert (collapsed, just past the new text). */
  caret: number
}

/**
 * Splice `text` into `value` at the current selection — the pure half of a
 * tap-to-type button (character rows, snippet inserts). The caller writes the
 * returned `value` back to its state and restores `caret` once the DOM updated.
 * A missing/out-of-range selection appends.
 */
export function insert_at_caret({ value, start, end, text }: {
  value: string
  start?: number | null
  end?: number | null
  text: string
}): CaretInsertion {
  const { length } = value
  const from = clamp({ value: start ?? length, max: length })
  const to = clamp({ value: end ?? from, max: length })
  const [left, right] = from <= to ? [from, to] : [to, from]
  return {
    value: value.slice(0, left) + text + value.slice(right),
    caret: left + text.length,
  }
}

function clamp({ value, max }: { value: number, max: number }): number {
  if (!Number.isFinite(value) || value < 0) return max
  return Math.min(value, max)
}

if (import.meta.vitest) {
  describe(insert_at_caret, () => {
    test('inserts at a collapsed caret', () => {
      expect(insert_at_caret({ value: 'wae', start: 2, end: 2, text: 'đ' }))
        .toEqual({ value: 'wađe', caret: 3 })
    })

    test('replaces a selection', () => {
      expect(insert_at_caret({ value: 'wade', start: 2, end: 3, text: 'đ' }))
        .toEqual({ value: 'wađe', caret: 3 })
    })

    test('appends when there is no selection', () => {
      expect(insert_at_caret({ value: 'wa', start: null, end: null, text: 'ʼ' }))
        .toEqual({ value: 'waʼ', caret: 3 })
    })

    test('handles a reversed or out-of-range selection', () => {
      expect(insert_at_caret({ value: 'wade', start: 3, end: 2, text: 'đ' }))
        .toEqual({ value: 'wađe', caret: 3 })
      expect(insert_at_caret({ value: 'wa', start: 99, end: 99, text: 'ə' }))
        .toEqual({ value: 'waə', caret: 3 })
    })

    test('counts a multi-codepoint grapheme by its UTF-16 length', () => {
      expect(insert_at_caret({ value: '', start: 0, end: 0, text: 'ą́' }))
        .toEqual({ value: 'ą́', caret: 2 })
    })
  })
}
