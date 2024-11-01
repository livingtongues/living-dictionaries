import type { EntryView } from '@living-dictionaries/types'
import type { EntryForCSV } from './prepareEntriesForCsv'
import { glossingLanguages } from '$lib/glosses/glossing-languages'

export function get_local_orthography_headers(
  alternate_orthographies: string[],
) {
  const headers: EntryForCSV = {}
  if (alternate_orthographies) {
    alternate_orthographies.forEach((lo, index) => {
      headers[`local_orthography_${index + 1}`] = lo
    })
  }
  return headers
}

// TODO: this needs done separately for each sense position. So you need to see what the max semantic domain count for sense 1 is, and then also for sense 2, etc... depending on the max sense count for all entries
export function get_semantic_domain_headers(entries: EntryView[]) {
  const headers: EntryForCSV = {}

  let max_semantic_domains = 0
  for (const entry of entries) {
    for (const sense of entry.senses || []) {
      if (sense.semantic_domains) {
        max_semantic_domains = Math.max(max_semantic_domains, sense.semantic_domains.length)
      }
    }
  }

  if (max_semantic_domains > 0) {
    for (let index = 0; index < max_semantic_domains; index++)
      headers[`semantic_domain_${index + 1}`] = `Semantic domain ${index + 1}`
  }
  return headers
}

export function get_gloss_language_headers(gloss_languages: string[]) {
  const headers: EntryForCSV = {}
  if (gloss_languages) {
    gloss_languages.forEach((bcp) => {
      headers[`${bcp}_gloss_language`] = `${glossingLanguages[bcp].vernacularName || bcp} Gloss`
    })
  }
  return headers
}

export function get_example_sentence_headers(
  gloss_languages: string[],
  dictionary_name: string,
) {
  const headers: EntryForCSV = {}
  // TODO, the vernacular is now sentence.text?.default and the languages are at sentence.translation[bcp]
  const _vernacular_example_sentence_header = `Example sentence in ${dictionary_name}`
  if (gloss_languages) {
    gloss_languages.forEach((bcp) => {
      headers[`${bcp}_example_sentence`] = `Example sentence in ${
        glossingLanguages[bcp].vernacularName || bcp
      }`
    })
  }
  return headers
}
