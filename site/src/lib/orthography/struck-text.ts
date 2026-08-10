/**
 * A struck letter with no precomposed codepoint (a word-processor strikethrough
 * baked into a source PDF) is stored as base + U+0336 COMBINING LONG STROKE
 * OVERLAY (`d̶`). That is the standards-correct DATA shape — NFC-stable, and
 * search simplification strips U+0336 back to the base letter.
 *
 * Fonts position the raw overlay by their own (often bad) anchor metrics —
 * Segoe UI drops it below/right of the base — so DISPLAY wraps the base
 * cluster in a CSS line-through span instead (StruckText.svelte), which the
 * browser places by font metrics, exactly like a word processor's strike.
 */

const COMBINING_MARK = /^\p{M}$/u
/** U+0335 short stroke overlay, U+0336 long stroke overlay. */
const STROKE_OVERLAYS = new Set(['̵', '̶'])
const HAS_STROKE_OVERLAY = /[̵̶]/u

export interface StruckSegment {
  text: string
  struck: boolean
}

export function has_struck(text: string): boolean {
  return HAS_STROKE_OVERLAY.test(text || '')
}

/**
 * Split a string into plain/struck segments for rendering. Each struck segment
 * is one base letter plus its non-overlay combining marks, with the overlay
 * itself dropped (the CSS line-through replaces it). A stray overlay with no
 * base letter is dropped rather than shown as a floating dash.
 */
export function split_struck_segments(text: string): StruckSegment[] {
  if (!has_struck(text)) return [{ text: text || '', struck: false }]
  const segments: StruckSegment[] = []
  let plain = ''
  const chars = [...text]
  for (let index = 0; index < chars.length; index++) {
    const char = chars[index]
    if (STROKE_OVERLAYS.has(char)) continue // stray overlay, no base
    let cluster = char
    let struck = false
    while (index + 1 < chars.length && COMBINING_MARK.test(chars[index + 1])) {
      index++
      if (STROKE_OVERLAYS.has(chars[index])) struck = true
      else cluster += chars[index]
    }
    if (struck) {
      if (plain) {
        segments.push({ text: plain, struck: false })
        plain = ''
      }
      segments.push({ text: cluster, struck: true })
    } else {
      plain += cluster
    }
  }
  if (plain) segments.push({ text: plain, struck: false })
  return segments
}

if (import.meta.vitest) {
  describe(split_struck_segments, () => {
    test('passes through text without overlays', () => {
      expect(split_struck_segments('dada')).toEqual([{ text: 'dada', struck: false }])
      expect(split_struck_segments('')).toEqual([{ text: '', struck: false }])
    })

    test('wraps each struck base, dropping the overlay', () => {
      expect(split_struck_segments('a\'d̶ad̶è')).toEqual([
        { text: 'a\'', struck: false },
        { text: 'd', struck: true },
        { text: 'a', struck: false },
        { text: 'd', struck: true },
        { text: 'è', struck: false },
      ])
    })

    test('handles uppercase and the short overlay', () => {
      expect(split_struck_segments('D̶d̵')).toEqual([
        { text: 'D', struck: true },
        { text: 'd', struck: true },
      ])
    })

    test('keeps other combining marks on a struck base', () => {
      expect(split_struck_segments('d̶́')).toEqual([{ text: 'd́', struck: true }])
    })

    test('drops a stray overlay with no base', () => {
      expect(split_struck_segments('̶d')).toEqual([{ text: 'd', struck: false }])
    })
  })
}
