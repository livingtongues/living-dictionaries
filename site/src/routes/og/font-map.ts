/**
 * Which Google Fonts family can draw a script satori asked us for.
 *
 * WHY THIS IS A FILE AND NOT SIX LINES INSIDE `render-worker.js`: the keys are a
 * CONTRACT WITH THE INSTALLED SATORI, and getting them wrong is invisible.
 * satori calls `loadAdditionalAsset(code, text)` with its own script code; an
 * unrecognised code falls through to `unknown` (plain Noto Sans), which
 * Google Fonts happily serves as a real, parseable TTF **containing none of the
 * requested glyphs**. The card then renders tofu boxes, returns 200, and is
 * cached for a year with no error anywhere.
 *
 * This map is the reason to care: satori **renamed every script code** between
 * 0.0.44 (`he`, `ja`, `zh`) and the BCP-47-shaped codes of 0.26+ (`he-IL`,
 * `ja-JP`, `zh-CN`). This repo sat on 0.0.44 for two and a half years; house
 * copy-ported the old map onto satori 0.26 on 2026-07-30 and every Hebrew and
 * CJK share card went to tofu boxes for a day, silently. LD's whole card
 * surface is non-Latin, so the same upgrade here without this file would have
 * been a far bigger version of that outage.
 *
 * So the map lives here, in TypeScript, next to a test that runs REAL satori
 * over real Hebrew/CJK/emoji text and asserts each code it emits resolves to a
 * font. The worker receives it through `workerData` (it cannot import project
 * files — see the header of `render-worker.js`).
 *
 * A SECOND TRAP, which the incident report did not have: **a code can name
 * several scripts at once.** satori joins every matching script with `|`, so Han
 * text arrives as `ja-JP|zh-CN|zh-TW|zh-HK` — a map keyed on a bare `zh-CN`
 * would STILL never match Chinese. `families_for_script` splits on `|` and keeps
 * every family the parts name, in satori's order; the loader fetches them all
 * and satori's own per-glyph fallback picks between them. That is also what
 * makes a mixed set right rather than a guess: 聖 exists in the JP face, 书 does
 * not, and nobody has to decide which of the four the reader meant.
 */

/**
 * The codes satori 0.29 can emit, verified against the installed library rather
 * than its docs (`hi` + `di` in `node_modules/satori/dist/index.js`; the test
 * re-derives them by rendering). `el`/Greek is deliberately absent — Greek
 * matches no script regex, so it arrives as `unknown`, and base Noto Sans draws
 * it. Indic + Thai cost nothing until a card needs them.
 */
export const LANGUAGE_FONT_MAP: Record<string, string[]> = {
  // `emoji` is checked before any language script, so it never arrives joined.
  // Noto EMOJI, not Noto COLOR Emoji: the colour font is a 20 MB CBDT blob that
  // Google will not subset (measured 2026-07-31 — `&text=🔥` returns the whole
  // file), and satori's opentype parser cannot draw its bitmap strikes anyway.
  // Monochrome outline glyphs are a real picture; a tofu box is not.
  'emoji': ['Noto+Emoji'],
  'symbol': ['Noto+Sans+Symbols', 'Noto+Sans+Symbols+2'],
  'math': ['Noto+Sans+Math'],

  'he-IL': ['Noto+Sans+Hebrew'],
  // NOT Noto Sans Arabic — satori parses fonts with
  // `@shuding/opentype.js`, which throws `lookupType: 5 - substFormat: 3 is not
  // yet supported` on the required-ligature table of EVERY Noto Arabic face
  // (verified 2026-07-31 against Noto Sans/Naskh/Kufi Arabic and Amiri; Cairo,
  // Tajawal and Markazi Text all parse). A face that throws is worse than no
  // face: it costs the whole render, not just the glyphs.
  'ar-AR': ['Cairo'],
  'ja-JP': ['Noto+Sans+JP'],
  'ko-KR': ['Noto+Sans+KR'],
  'zh-CN': ['Noto+Sans+SC'],
  'zh-TW': ['Noto+Sans+TC'],
  'zh-HK': ['Noto+Sans+HK'],
  'th-TH': ['Noto+Sans+Thai'],
  'bn-IN': ['Noto+Sans+Bengali'],
  'ta-IN': ['Noto+Sans+Tamil'],
  'ml-IN': ['Noto+Sans+Malayalam'],
  'te-IN': ['Noto+Sans+Telugu'],
  'devanagari': ['Noto+Sans+Devanagari'],
  'kannada': ['Noto+Sans+Kannada'],

  /** satori's own "no script matched" — Latin, Greek, Cyrillic. Base Noto Sans covers them. */
  'unknown': ['Noto+Sans'],
}

export interface ScriptFamilies {
  /** Families to fetch, in satori's own priority order. Never empty. */
  families: string[]
  /**
   * FALSE means nothing in `code` was in the map and this is the `unknown`
   * rescue — the render will survive and the glyphs will be missing, which is
   * the failure the caller has to make loud.
   */
  mapped: boolean
}

/**
 * The families to load for one satori script code, which may name several
 * scripts joined by `|` (see the file header).
 *
 * MIRRORED, deliberately and minimally, inside `render-worker.js` — an eval'd
 * worker cannot import this. The map itself is not duplicated: it travels in
 * `workerData`.
 */
export function families_for_script({ code }: { code: string }): ScriptFamilies {
  const families = [...new Set(String(code).split('|').flatMap(part => LANGUAGE_FONT_MAP[part] ?? []))]
  if (families.length)
    return { families, mapped: true }
  return { families: LANGUAGE_FONT_MAP.unknown, mapped: false }
}
