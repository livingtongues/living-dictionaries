import type { Orthography } from '$lib/db/schemas/shared.types'
import { get_orthographies } from './orthographies'

/** How many characters one orthography may register (a tap-row, not a keyboard). */
export const MAX_SPECIAL_CHARACTERS = 40
/** UTF-16 units per item — a base letter plus a couple of combining marks (`ą́`, `ǫ̈`). */
const MAX_CHARACTER_LENGTH = 8

const COMBINING_MARK = /^\p{M}$/u
const NON_ASCII = /[^\u0020-\u007E]/

/**
 * Every special character the dictionary's writing systems registered, in registry
 * order and deduped — the tap-buttons shown beside search. Empty when nothing is
 * configured (most dictionaries), which is the signal to render nothing at all.
 */
export function get_special_characters({ orthographies }: { orthographies?: Orthography[] | null }): string[] {
  const seen = new Set<string>()
  const characters: string[] = []
  for (const orthography of get_orthographies({ orthographies }).all) {
    for (const character of orthography.characters || []) {
      if (!character || seen.has(character)) continue
      seen.add(character)
      characters.push(character)
    }
  }
  return characters
}

/** Normalize a stored/incoming list: trim, drop blanks + over-long items, dedupe, cap. */
export function clean_characters(characters: unknown): string[] {
  if (!Array.isArray(characters)) return []
  const seen = new Set<string>()
  const cleaned: string[] = []
  for (const raw of characters) {
    if (typeof raw !== 'string') continue
    const character = raw.trim().normalize('NFC')
    if (!character || character.length > MAX_CHARACTER_LENGTH) continue
    if (seen.has(character)) continue
    seen.add(character)
    cleaned.push(character)
    if (cleaned.length === MAX_SPECIAL_CHARACTERS) break
  }
  return cleaned
}

/** Server-side guard for a written `characters` value (throws on the wrong shape). */
export function validate_characters(characters: unknown): string[] {
  if (characters === null || characters === undefined) return []
  if (!Array.isArray(characters)) throw new Error('characters must be an array of strings')
  for (const character of characters) {
    if (typeof character !== 'string') throw new Error('characters must be an array of strings')
    if (character.trim().length > MAX_CHARACTER_LENGTH) throw new Error(`character "${character}" is too long`)
  }
  return clean_characters(characters)
}

/** The editor types a space-separated row (`đ ʼ ą ę`); split it back into items. */
export function parse_characters_input(text: string): string[] {
  return clean_characters((text || '').split(/[\s,]+/))
}

export function format_characters(characters: string[] | undefined | null): string {
  return (characters || []).join(' ')
}

/**
 * Frequency-ranked inventory of the non-ASCII characters actually used in a set of
 * headwords — what the settings "Detect" button proposes so a manager never has to
 * hunt for codepoints. Combining marks stay attached to their base letter (`ą́` is one
 * item), and everything is folded to lowercase since that's what typers need.
 */
export function derive_special_characters({ texts, limit = 16 }: { texts: string[], limit?: number }): string[] {
  const counts = new Map<string, number>()
  for (const text of texts) {
    if (!text) continue
    for (const cluster of to_clusters(text.normalize('NFC'))) {
      if (!NON_ASCII.test(cluster)) continue
      const key = cluster.toLowerCase()
      counts.set(key, (counts.get(key) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort(([char_a, count_a], [char_b, count_b]) => count_b - count_a || char_a.localeCompare(char_b))
    .slice(0, limit)
    .map(([character]) => character)
}

/** Base character + any trailing combining marks, one item at a time. */
function to_clusters(text: string): string[] {
  const clusters: string[] = []
  for (const code_point of text) {
    if (clusters.length && COMBINING_MARK.test(code_point))
      clusters[clusters.length - 1] += code_point
    else
      clusters.push(code_point)
  }
  return clusters
}

if (import.meta.vitest) {
  describe(get_special_characters, () => {
    test('empty when nothing is configured', () => {
      expect(get_special_characters({ orthographies: null })).toEqual([])
      expect(get_special_characters({ orthographies: [{ code: 'default', name: '' }] })).toEqual([])
    })

    test('unions the registry in order, deduped', () => {
      expect(get_special_characters({
        orthographies: [
          { code: 'default', name: 'Ponca', characters: ['đ', 'ʼ', 'ə'], primary: true },
          { code: 'village', name: 'Village', characters: ['ə', 'ʃ'] },
        ],
      })).toEqual(['đ', 'ʼ', 'ə', 'ʃ'])
    })
  })

  describe(clean_characters, () => {
    test('trims, drops blanks and duplicates', () => {
      expect(clean_characters([' đ ', '', 'đ', 'ʼ', 5])).toEqual(['đ', 'ʼ'])
    })

    test('keeps a combining grapheme but drops an over-long item', () => {
      expect(clean_characters(['ą́', 'abcdefghi'])).toEqual(['ą́'])
    })

    test('caps the list', () => {
      const many = Array.from({ length: 60 }, (_, index) => String.fromCodePoint(0x100 + index))
      expect(clean_characters(many)).toHaveLength(MAX_SPECIAL_CHARACTERS)
    })
  })

  describe(validate_characters, () => {
    test('null/undefined are an empty list', () => {
      expect(validate_characters(null)).toEqual([])
      expect(validate_characters(undefined)).toEqual([])
    })

    test('throws on a non-array or non-string item', () => {
      expect(() => validate_characters('đʼ')).toThrow('characters must be an array of strings')
      expect(() => validate_characters([1])).toThrow('characters must be an array of strings')
    })

    test('throws on an over-long item', () => {
      expect(() => validate_characters(['abcdefghij'])).toThrow('too long')
    })
  })

  describe(parse_characters_input, () => {
    test('splits on whitespace and commas', () => {
      expect(parse_characters_input('đ ʼ  ą,ę')).toEqual(['đ', 'ʼ', 'ą', 'ę'])
      expect(parse_characters_input('')).toEqual([])
    })
  })

  describe(format_characters, () => {
    test('joins with spaces', () => {
      expect(format_characters(['đ', 'ʼ'])).toBe('đ ʼ')
      expect(format_characters(undefined)).toBe('')
    })
  })

  describe(derive_special_characters, () => {
    test('ranks non-ASCII characters by frequency, ignoring ASCII', () => {
      expect(derive_special_characters({ texts: ['đaʼ', 'đe', 'wađe'] })).toEqual(['đ', 'ʼ'])
    })

    test('keeps a combining mark with its base and folds case', () => {
      expect(derive_special_characters({ texts: ['Ą́ba', 'ą́be', 'ną'] })).toEqual(['ą́', 'ą'])
    })

    test('honors the limit', () => {
      expect(derive_special_characters({ texts: ['đʼəʃ'], limit: 2 })).toHaveLength(2)
    })
  })
}
