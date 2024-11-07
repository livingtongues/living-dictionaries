import type { EntryView, MultiString } from '@living-dictionaries/types'
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

  // Using for of loops for a slightly better performance
  for (const entry of entries) {
    for (const [sense_index, sense] of Array.from(entry.senses).entries()) {
      //* get glosses headers
      headers = { ...headers, ...get_gloss_language_headers(sense.glosses, sense_index) }
      //* get semantic domains headers
      headers = { ...headers, ...get_semantic_domain_headers(sense.semantic_domains, sense_index) }
      //* get parts of speech headers
      // @ts-ignore
      headers = { ...headers, ...get_parts_of_speech_headers(sense.parts_of_speech_abbreviations, sense.parts_of_speech, sense_index) }
      //* get example sentences headers
      // @ts-ignore
      if (sense.sentences) {
        // @ts-ignore
        headers = { ...headers, ...get_example_sentence_headers(sense.sentences[0], sense_index) }
      }
    }
  }

  return headers
}

export function get_gloss_language_headers(glosses: MultiString, sense_index: number) {
  const headers: EntryForCSV = {}
  if (glosses) {
    Object.keys(glosses).forEach((bcp) => {
      headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}${bcp}_gloss`] = `${glossingLanguages[bcp].vernacularName || bcp} Gloss`
    })
  }
  return headers
}

export function get_semantic_domain_headers(semantic_domains: string[], sense_index: number) {
  const headers: EntryForCSV = {}
  if (semantic_domains) {
    for (let index = 0; index < semantic_domains.length; index++) {
      headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}semanticDomain${index > 0 ? `.${index + 1}` : ''}`] = `Semantic domain ${index + 1}`
    }
  }
  return headers
}

export function get_parts_of_speech_headers(parts_of_speech_abbreviations: string[], parts_of_speech: string[], sense_index: number) {
  const headers: EntryForCSV = {}
  if (parts_of_speech) {
    for (let index = 0; index < parts_of_speech_abbreviations.length; index++) {
      headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}partOfSpeech${index > 0 ? `.${index + 1}` : ''}`] = `Part of speech ${index + 1} (abbreviation)`
      headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}partOfSpeech fullname${index > 0 ? `.${index + 1}` : ''}`] = `Part of speech ${index + 1}`
    }
  }
  return headers
}

export function get_example_sentence_headers(
  sentence: MultiString,
  sense_index: number,
) {
  const headers: EntryForCSV = {}
  if (sentence?.text) {
    headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}vernacular_exampleSentence`] = `Example sentence in ${sentence?.dictionary_id}`
  }
  if (sentence?.translation) {
    Object.keys(sentence?.translation).forEach((bcp) => {
      headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}${bcp}_exampleSentence`] = `Example sentence in ${glossingLanguages[bcp].vernacularName || bcp}`
    })
  }

  return headers
}

// TODO variant, noun class and plural form
