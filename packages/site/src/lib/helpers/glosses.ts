import type { IExampleSentence, MultiString } from '@living-dictionaries/types'
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

export function order_example_sentences({ example_sentences, dictionary_gloss_languages }:
{
  example_sentences: IExampleSentence
  dictionary_gloss_languages: string[]
},
): string[] {
  if (!example_sentences || !example_sentences.vn) return []

  const sorted_example_sentences = dictionary_gloss_languages.map(bcp => example_sentences[bcp]).filter(Boolean)
  sorted_example_sentences.unshift(example_sentences.vn) // vernacular example sentence should be always the first sentence

  return sorted_example_sentences
}

export function order_entry_and_dictionary_gloss_languages(
  glosses: MultiString,
  dictionary_gloss_languages: string[],
): string[] {
  const combined_glossing_languages = [...dictionary_gloss_languages, ...Object.keys(glosses || {})]
  const deduplicated_glossing_languages = [...new Set(combined_glossing_languages)]
  return deduplicated_glossing_languages
}
