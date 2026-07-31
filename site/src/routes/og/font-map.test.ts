import satori from 'satori'
import { html } from 'satori-html'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { families_for_script, LANGUAGE_FONT_MAP } from './font-map'

/**
 * THE TEST THAT MAKES A SATORI UPGRADE SAFE.
 *
 * satori renamed every script code between 0.0.44 (`he`, `ja`, `zh`) and 0.26+
 * (`he-IL`, `ja-JP`, `zh-CN`). house crossed that boundary on 2026-07-30 with
 * the old map and every Hebrew and CJK card rendered tofu for a day while
 * NOTHING failed — the `unknown` rescue fetched a real Noto Sans that simply had
 * no Hebrew in it. This repo's cards are almost entirely non-Latin, so the same
 * mistake here would have been the whole surface.
 *
 * So this asks the INSTALLED LIBRARY, never a docs page or a sibling repo: it
 * renders real text in each script through real satori and captures the exact
 * code handed to `loadAdditionalAsset`. No network — the loader returns nothing,
 * which is all satori needs to tell us what it wanted.
 */

const font = readFileSync(fileURLToPath(new URL('./notoSans.ttf', import.meta.url)))

/** The code(s) satori asks for when it meets this text, in the order it asks. */
async function scripts_satori_asks_for(text: string): Promise<string[]> {
  const codes: string[] = []
  await satori(html(`<div style="display: flex">${text}</div>`), {
    fonts: [{ name: 'Noto+Sans', data: font, style: 'normal' }],
    width: 400,
    height: 100,
    loadAdditionalAsset: (code) => {
      codes.push(code)
      return Promise.resolve(undefined as unknown as string)
    },
  })
  return codes
}

/** Scripts a Bible-study card can actually carry, plus the ones that broke. */
const SAMPLES: { name: string, text: string, expect_family: string }[] = [
  { name: 'Hebrew', text: 'מַלְאָך', expect_family: 'Noto+Sans+Hebrew' },
  { name: 'Chinese — arrives as a `|`-joined list of four locales', text: '聖書', expect_family: 'Noto+Sans+JP' },
  { name: 'Japanese kana', text: 'ひらがな', expect_family: 'Noto+Sans+JP' },
  { name: 'Korean', text: '한국어', expect_family: 'Noto+Sans+KR' },
  { name: 'Arabic', text: 'العربية', expect_family: 'Cairo' },
  { name: 'Devanagari', text: 'नमस्ते', expect_family: 'Noto+Sans+Devanagari' },
  { name: 'Thai', text: 'สวัสดี', expect_family: 'Noto+Sans+Thai' },
  { name: 'emoji', text: '🔥', expect_family: 'Noto+Emoji' },
]

describe(families_for_script, () => {
  for (const { name, text, expect_family } of SAMPLES) {
    test(`${name} resolves to a font that can draw it`, async () => {
      const [code, ...rest] = await scripts_satori_asks_for(text)
      expect(rest).toEqual([])
      const { families, mapped } = families_for_script({ code })
      expect(mapped).toBeTruthy()
      expect(families[0]).toBe(expect_family)
    })
  }

  test('Greek needs no dynamic font at all — it is in the bundled Noto Sans', async () => {
    // It arrives as `unknown` (satori has no Greek regex), which is WHY the
    // broken map looked fine for Greek while Hebrew was blank boxes.
    expect(await scripts_satori_asks_for('λόγος')).toEqual(['unknown'])
    expect(families_for_script({ code: 'unknown' })).toEqual({ families: ['Noto+Sans'], mapped: true })
  })

  test('a code naming SEVERAL scripts keeps every family, in satori order', () => {
    // Han matches four locales at once, so this is the real shape of a Chinese
    // card — a map keyed on a bare `zh-CN` would never match it.
    expect(families_for_script({ code: 'ja-JP|zh-CN|zh-TW|zh-HK' })).toEqual({
      families: ['Noto+Sans+JP', 'Noto+Sans+SC', 'Noto+Sans+TC', 'Noto+Sans+HK'],
      mapped: true,
    })
  })

  test('an unmapped script is REPORTED as unmapped, not quietly rescued', () => {
    // `mapped: false` is the whole alarm: the `unknown` rescue keeps the render
    // alive, and the caller has to say out loud that the glyphs are missing.
    expect(families_for_script({ code: 'xx-XX' })).toEqual({ families: ['Noto+Sans'], mapped: false })
    expect(families_for_script({ code: 'he' })).toEqual({ families: ['Noto+Sans'], mapped: false })
  })

  test('EVERY key is a code the installed satori can emit — the version-bump tripwire', () => {
    // Read from satori's own bundle rather than a list we maintain: the day a
    // satori upgrade renames these again, this fails instead of the cards.
    const source = readFileSync(fileURLToPath(import.meta.resolve('satori')), 'utf8')
    const satori_codes = new Set([
      ...source.matchAll(/"?([a-zA-Z-]+)"?:\/\\p\{scx=/g),
      ...source.matchAll(/\b(emoji|symbol|math):(?:\/\\p\{(?:Symbol|Math)\}\/u|[A-Za-z_$]\w*)/g),
    ].map(match => match[1]))

    // eslint-disable-next-line no-restricted-syntax -- "did the regex find satori's table at all", not a count
    expect(satori_codes.size).toBeGreaterThanOrEqual(14)
    const unknown_to_satori = Object.keys(LANGUAGE_FONT_MAP).filter(code => code !== 'unknown' && !satori_codes.has(code))
    expect(unknown_to_satori).toEqual([])
  })
})
