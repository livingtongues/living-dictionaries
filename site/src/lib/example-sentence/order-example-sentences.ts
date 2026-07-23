import type { Tables } from '$lib/types'

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
