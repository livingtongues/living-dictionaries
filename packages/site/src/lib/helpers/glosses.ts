import type { MultiString, Tables } from '@living-dictionaries/types'
import type { TranslateFunction } from '$lib/i18n/types'

export function order_glosses({ glosses, dictionary_gloss_languages, t, label = false }:
{
  glosses: MultiString
  dictionary_gloss_languages: string[]
  t: TranslateFunction
  label?: boolean
},
): string[] {
  if (!glosses) return []

  const sorted_gloss_languages = order_entry_and_dictionary_gloss_languages(glosses, dictionary_gloss_languages)

  const gloss_languages_that_have_gloss = sorted_gloss_languages.filter(bcp => glosses[bcp])

  return gloss_languages_that_have_gloss.map((bcp) => {
    const gloss = glosses[bcp]
    if (label) return `${t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}: ${gloss}`
    return gloss
  })
}

export function order_example_sentences({ sentence, dictionary_gloss_languages }:
{
  sentence: Partial<Tables<'sentences'>>
  dictionary_gloss_languages: string[]
},
): string[] {
  if (!sentence?.text?.default) return []

  const sorted_sentence_translations = dictionary_gloss_languages.map(bcp => sentence.translation?.[bcp]).filter(Boolean)
  return [sentence.text.default, sorted_sentence_translations].flat()
}

export function order_entry_and_dictionary_gloss_languages(
  glosses: MultiString,
  dictionary_gloss_languages: string[],
): string[] {
  const combined_glossing_languages = [...dictionary_gloss_languages, ...Object.keys(glosses || {})]
  const deduplicated_glossing_languages = [...new Set(combined_glossing_languages)]
  return deduplicated_glossing_languages
}
