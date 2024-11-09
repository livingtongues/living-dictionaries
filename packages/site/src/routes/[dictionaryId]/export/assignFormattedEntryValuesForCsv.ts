import type { EntryView, MultiString, PartOfSpeech, Tables } from '@living-dictionaries/types'
import type { EntryForCSV } from './prepareEntriesForCsv'
import { friendlyName } from './friendlyName'

export function find_part_of_speech_abbreviation(
  global_parts_of_speech: PartOfSpeech[],
  part_of_speech: string,
): string {
  return global_parts_of_speech.find(({ enName }) => enName === part_of_speech)?.enAbbrev
}

export function get_first_speaker_from_first_sound_file(
  entry: EntryView,
  speakers: Tables<'speakers_view'>[],
) {
  return speakers.find(speaker => speaker?.id === entry.audios?.[0].speaker_ids?.[0])
}

export function display_speaker_gender(speaker_gender: string): string {
  if (speaker_gender) return speaker_gender === 'f' ? 'female' : 'male'
}

export function format_senses(entry: EntryView) {
  let formatted_domains = {}

  for (const [sense_index, sense] of Array.from(entry.senses).entries()) {
    //* glosses
    formatted_domains = { ...formatted_domains, ...format_glosses(sense.glosses, sense_index) }
    //* sematic domains
    formatted_domains = { ...formatted_domains, ...format_semantic_domain(sense.semantic_domains, sense_index) }
    //* parts of speech
    // @ts-ignore
    formatted_domains = { ...formatted_domains, ...format_parts_of_speech(sense.parts_of_speech_abbreviations, sense.parts_of_speech, sense_index) }
    //* noun class
    formatted_domains = { ...formatted_domains, ...format_noun_class(sense.noun_class, sense_index) }
    //* variant
    formatted_domains = { ...formatted_domains, ...format_variant(sense.variant, sense_index) }
    //* plural form
    formatted_domains = { ...formatted_domains, ...format_plural_form(sense.plural_form, sense_index) }
    //* Images
    // @ts-ignore
    formatted_domains = { ...formatted_domains, ...format_image_files(entry, sense.photo_urls?.[0], sense_index) }
    //* example sentences
    // @ts-ignore
    formatted_domains = { ...formatted_domains, ...format_example_sentence(sense.sentences?.[0], sense_index) }
  }

  return formatted_domains
}

export function format_glosses(glosses: MultiString, sense_index: number) {
  const formatted_domains: EntryForCSV = {}
  if (glosses) {
    Object.entries(glosses).forEach(([bcp, value]) => {
      formatted_domains[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}${bcp}_gloss`] = value
    })
  }

  return formatted_domains
}

export function format_semantic_domain(semantic_domains: string[], sense_index: number) {
  const formatted_domains: EntryForCSV = {}
  if (semantic_domains) {
    for (let index = 0; index < semantic_domains.length; index++) {
      formatted_domains[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}semanticDomain${index > 0 ? `.${index + 1}` : ''}`] = `"${semantic_domains[index]}"` // TODO should I do this for all fields?
    }
  }
  return formatted_domains
}

export function format_parts_of_speech(parts_of_speech_abbreviations: string[], parts_of_speech: string[], sense_index: number) {
  const formatted_domains: EntryForCSV = {}
  if (parts_of_speech) {
    for (let index = 0; index < parts_of_speech_abbreviations.length; index++) {
      formatted_domains[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}partOfSpeech${index > 0 ? `.${index + 1}` : ''}`] = parts_of_speech_abbreviations[index]
      formatted_domains[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}partOfSpeech fullname${index > 0 ? `.${index + 1}` : ''}`] = parts_of_speech[index]
    }
  }
  return formatted_domains
}
export function format_noun_class(noun_class: string, sense_index: number) {
  const formatted_domains: EntryForCSV = {}
  if (noun_class) {
    formatted_domains[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}nounClass`] = noun_class
  }
  return formatted_domains
}
export function format_variant(variant: MultiString, sense_index: number) {
  const formatted_domains: EntryForCSV = {}
  if (variant?.default) {
    formatted_domains[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}variant`] = variant.default
  }
  return formatted_domains
}
export function format_plural_form(plural_form: MultiString, sense_index: number) {
  const formatted_domains: EntryForCSV = {}
  if (plural_form?.default) {
    formatted_domains[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}pluralForm`] = plural_form.default
  }
  return formatted_domains
}

export function format_image_files(entry: EntryView, image_storage_path: string, sense_index: number) {
  const formatted_domains: EntryForCSV = {}

  if (image_storage_path) {
    formatted_domains[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}photoFile`] = friendlyName(entry, image_storage_path)
    formatted_domains[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}photoSource`] = image_storage_path
  }

  return formatted_domains
}

export function format_example_sentence(
  sentence: MultiString,
  sense_index: number,
) {
  const headers: EntryForCSV = {}
  if (sentence?.text) {
    // @ts-ignore
    headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}vernacular_exampleSentence`] = sentence.text?.default
  }
  if (sentence?.translation) {
    Object.keys(sentence?.translation).forEach((bcp) => {
      headers[`${sense_index > 0 ? `s${sense_index + 1}.` : ''}${bcp}_exampleSentence`] = sentence.translation?.[bcp]
    })
  }

  return headers
}
// export function format_semantic_domains(
//   entry: ExpandedEntry,
// ): EntryForCSV {
//   const domains = {}
//   for (const [index, domain] of (entry.senses?.[0].translated_ld_semantic_domains || []).entries())
//     domains[`semantic_domain_${index + 1}`] = domain
//   return domains
// }

// export function format_gloss_languages(
//   entry: ExpandedEntry,
// ): EntryForCSV {
//   const gloss_languages = {}
//   for (const [bcp, value] of Object.entries(entry.senses?.[0].glosses || {}))
//     gloss_languages[`${bcp}_gloss_language`] = value
//   return gloss_languages
// }

// export function format_example_sentences(
//   entry: ExpandedEntry,
// ): EntryForCSV {
//   const example_sentences: EntryForCSV = {}
//   for (const [bcp, value] of Object.entries(entry.senses?.[0].example_sentences?.[0] || {})) {
//     if (bcp === 'vn')
//       example_sentences.vernacular_example_sentence = value
//     else
//       example_sentences[`${bcp}_example_sentence`] = value
//   }
//   return example_sentences
// }
