import type { MultiString, Tables } from '@living-dictionaries/types'
import type { EntryForCSV, translate_entries } from './prepareEntriesForCsv'
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

export function get_sense_headers(entries: ReturnType<typeof translate_entries>) {
  let headers: EntryForCSV = {}

  for (const entry of entries) {
    for (const [sense_index, sense] of Array.from(entry.senses).entries()) {
      headers = {
        ...headers,
        ...get_gloss_language_headers(sense.glosses, sense_index),
        ...get_semantic_domain_headers(sense.semantic_domains, sense_index),
        ...get_parts_of_speech_headers(sense.parts_of_speech_abbreviations, sense.parts_of_speech, sense_index),
        ...get_noun_class_headers(sense.noun_class, sense_index),
        ...get_variant_headers(sense.variant, sense_index),
        ...get_plural_form_headers(sense.plural_form, sense_index),
        ...get_image_files_headers(sense?.photo_ids?.[0], sense_index),
        ...(sense.sentences ? get_example_sentence_headers(sense.sentences[0], sense_index) : {}),
      }
    }
  }

  return headers
}

export function get_gloss_language_headers(glosses: MultiString, sense_index: number) {
  const headers: EntryForCSV = {}
  if (glosses) {
    Object.keys(glosses).forEach((bcp) => {
      headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}${bcp}_gloss`] = `${sense_index > 0 ? `Sense ${sense_index + 1}: ` : ''}${glossingLanguages[bcp].vernacularName || bcp} Gloss`
    })
  }
  return headers
}

export function get_semantic_domain_headers(semantic_domains: string[], sense_index: number) {
  const headers: EntryForCSV = {}
  if (semantic_domains) {
    for (let index = 0; index < semantic_domains.length; index++) {
      headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}semanticDomain${index > 0 ? `.${index + 1}` : ''}`] = `${sense_index > 0 ? `Sense ${sense_index + 1}: ` : ''}Semantic domain ${index + 1}`
    }
  }
  return headers
}

export function get_parts_of_speech_headers(parts_of_speech_abbreviations: string[], parts_of_speech: string[], sense_index: number) {
  const headers: EntryForCSV = {}
  if (parts_of_speech) {
    for (let index = 0; index < parts_of_speech_abbreviations.length; index++) {
      headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}partOfSpeech${index > 0 ? `.${index + 1}` : ''}`] = `${sense_index > 0 ? `Sense ${sense_index + 1}: ` : ''}Part of speech ${index + 1} (abbreviation)`
      headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}partOfSpeech fullname${index > 0 ? `.${index + 1}` : ''}`] = `${sense_index > 0 ? `Sense ${sense_index + 1}: ` : ''}Part of speech ${index + 1}`
    }
  }
  return headers
}

export function get_example_sentence_headers(
  sentence: Tables<'sentences'>,
  sense_index: number,
) {
  const headers: EntryForCSV = {}
  if (sentence?.text) {
    headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}vernacular_exampleSentence`] = `${sense_index > 0 ? `Sense ${sense_index + 1}: ` : ''}Example sentence in ${sentence?.dictionary_id}`
  }
  if (sentence?.translation) {
    Object.keys(sentence?.translation).forEach((bcp) => {
      headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}${bcp}_exampleSentence`] = `${sense_index > 0 ? `Sense ${sense_index + 1}: ` : ''}Example sentence in ${glossingLanguages[bcp].vernacularName || bcp}`
    })
  }

  return headers
}

export function get_image_files_headers(image_storage_path: string, sense_index: number) {
  const headers: EntryForCSV = {}

  if (image_storage_path) {
    headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}photoFile`] = `${sense_index > 0 ? `Sense ${sense_index + 1}: ` : ''}Image filename`
    headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}photoSource`] = `${sense_index > 0 ? `Sense ${sense_index + 1}: ` : ''}Source of image`
  }

  return headers
}

export function get_noun_class_headers(noun_class: string, sense_index: number) {
  const headers: EntryForCSV = {}
  if (noun_class) {
    headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}nounClass`] = `${sense_index > 0 ? `Sense ${sense_index + 1}: ` : ''}Noun class`
  }
  return headers
}
export function get_variant_headers(variant: MultiString, sense_index: number) {
  const headers: EntryForCSV = {}
  if (variant?.default) {
    headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}variant`] = `${sense_index > 0 ? `Sense ${sense_index + 1}: ` : ''}Variant`
  }
  return headers
}
export function get_plural_form_headers(plural_form: MultiString, sense_index: number) {
  const headers: EntryForCSV = {}
  if (plural_form?.default) {
    headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}pluralForm`] = `${sense_index > 0 ? `Sense ${sense_index + 1}: ` : ''}Plural form`
  }
  return headers
}
