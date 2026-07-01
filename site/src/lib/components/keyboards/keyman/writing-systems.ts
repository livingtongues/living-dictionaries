import { additionalKeyboards, glossingLanguages } from '../../../glosses/glossing-languages'

/** One entry of the minimal Keyman writing-systems map (`keyman-writing-systems.json`). */
export interface KeymanWritingSystem {
  /** Keyman keyboard id (the `internalName` KeymanWeb loads). */
  id: string
  /** Language / writing-system display name. */
  name: string
  /** Optional font family the script needs. */
  font?: string
}
export type KeymanWritingSystems = Record<string, KeymanWritingSystem>

let cache: Promise<KeymanWritingSystems> | undefined

/**
 * Lazy-load the full (~2,204-tag) Keyman writing-systems map. Kept out of the
 * main bundle — only pulled when the orthography picker searches beyond the
 * eager 302-entry glossing-languages list, or when resolving an alternate
 * orthography's keyboard. Caches the in-flight promise so concurrent callers
 * share one import.
 */
export function load_keyman_writing_systems(): Promise<KeymanWritingSystems> {
  if (!cache)
    cache = import('./keyman-writing-systems.json').then(module => module.default as KeymanWritingSystems)
  return cache
}

export interface ResolvedKeyboard {
  /** Keyman keyboard id passed to `addKeyboards` / `setKeyboardForControl`. */
  internalName: string
  /** BCP tag paired with the keyboard id. */
  keyboardBcp: string
}

/**
 * Resolve a BCP tag to a Keyman keyboard, checking (in order) the curated gloss
 * languages, the hand-added extra keyboards, then the full Keyman set (if loaded).
 * Returns undefined when no keyboard is known for the tag.
 */
export function keyboard_for_bcp(
  bcp: string | undefined,
  keyman_writing_systems?: KeymanWritingSystems,
): ResolvedKeyboard | undefined {
  if (!bcp) return undefined
  const gloss = glossingLanguages[bcp] || additionalKeyboards[bcp]
  if (gloss?.internalName)
    return { internalName: gloss.internalName, keyboardBcp: gloss.useKeyboard || bcp }
  const keyman = keyman_writing_systems?.[bcp]
  if (keyman)
    return { internalName: keyman.id, keyboardBcp: bcp }
  return undefined
}

/**
 * True when `code` collides with a reserved token or a tag already known to one
 * of our lists — i.e. it must NOT be accepted as a fresh custom orthography code
 * (the user should pick it from the list instead so it wires up its keyboard).
 * Pass the loaded Keyman set to also guard against the full writing-system set.
 */
export function is_reserved_or_known_code(
  code: string,
  keyman_writing_systems?: KeymanWritingSystems,
): boolean {
  if (code === 'default' || /^lo\d+$/.test(code)) return true
  if (glossingLanguages[code] || additionalKeyboards[code]) return true
  return !!keyman_writing_systems?.[code]
}

if (import.meta.vitest) {
  describe(keyboard_for_bcp, () => {
    test('resolves via additionalKeyboards', () => {
      expect(keyboard_for_bcp('srb-sora')).toEqual({ internalName: 'basic_kbdsora', keyboardBcp: 'srb-sora' })
    })
    test('resolves via the loaded Keyman set when not in gloss lists', () => {
      const keyman = { 'aho-ahom': { id: 'ahom_star', name: 'Ahom' } }
      expect(keyboard_for_bcp('aho-ahom', keyman)).toEqual({ internalName: 'ahom_star', keyboardBcp: 'aho-ahom' })
    })
    test('undefined for unknown tag', () => {
      expect(keyboard_for_bcp('zzz-Zzzz')).toBeUndefined()
      expect(keyboard_for_bcp(undefined)).toBeUndefined()
    })
  })

  describe(is_reserved_or_known_code, () => {
    test('reserves default + lo{n}', () => {
      expect(is_reserved_or_known_code('default')).toBe(true)
      expect(is_reserved_or_known_code('lo1')).toBe(true)
      expect(is_reserved_or_known_code('lo23')).toBe(true)
    })
    test('flags known gloss/additional tags', () => {
      expect(is_reserved_or_known_code('srb-sora')).toBe(true)
      expect(is_reserved_or_known_code('en')).toBe(true)
    })
    test('allows a genuine custom slug', () => {
      expect(is_reserved_or_known_code('village-spelling')).toBe(false)
    })
  })
}
