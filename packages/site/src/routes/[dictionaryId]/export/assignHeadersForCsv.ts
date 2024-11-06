import type { EntryView, SenseWithSentences } from '@living-dictionaries/types'
import type { EntryForCSV } from './prepareEntriesForCsv'
import { glossingLanguages } from '$lib/glosses/glossing-languages'

export function get_local_orthography_headers(
  alternate_orthographies: string[],
) {
  const headers: EntryForCSV = {}
  if (alternate_orthographies) {
    alternate_orthographies.forEach((lo, index) => {
      if (index > 0) {
        headers[`localOrthography.${index + 1}`] = lo
      } else {
        // @ts-ignore
        headers.localOrthography = lo
      }
    })
  }
  return headers
}

export function get_sense_headers(entries: EntryView[]) {
  let headers: EntryForCSV = {}

  // Using for of loop for a slightly better performance
  for (const entry of entries) {
    console.info(`Entry: ${JSON.stringify(entry)}`)
    headers = { ...headers, ...get_semantic_domain_headers(entry.senses) }
    // for (const sense of entry.senses) {
    //   console.log(`sense: ${sense}`)
    // }
  }

  // if (max_senses_in_dictionary > 0) {
  //   for (let index = 0; index <= max_senses_in_dictionary; index++) {
  //     headers = { ...headers, ...get_semantic_domain_headers(entries[index].senses, index) }
  //   }
  // }

  return headers
}

export function get_semantic_domain_headers(senses: SenseWithSentences[]) {
  const headers: EntryForCSV = {}

  for (const [sense_index, sense] of Array.from(senses).entries()) {
    if (sense.semantic_domains) {
      // max_semantic_domains = Math.max(max_semantic_domains, sense.semantic_domains.length)
      for (let index = 0; index < sense.semantic_domains.length; index++) {
        headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}semanticDomain${index > 0 ? `.${index + 1}` : ''}`] = `Semantic domain ${index + 1}`
      }
    }
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
