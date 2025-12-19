import type { DeepPartial, EntryData, MultiString } from '@living-dictionaries/types'
import type { EntryForCSV, translate_entries } from './prepareEntriesForCsv'
import { friendlyName } from './friendlyName'
import { glossingLanguages } from '$lib/glosses/glossing-languages'

interface ExportMetaData {
  sense_index: number
  position: 'header' | 'value'
}

function count_index(index: number) {
  return index > 0 ? `.${index + 1}` : ''
}

function count_sense(sense_index: number): string {
  return `${sense_index > 0 ? `s${sense_index + 1}.` : ''}`
}

function get_readable_sense(sense_index: number): string {
  return `${sense_index > 0 ? `Sense ${sense_index + 1}: ` : ''}`
}

export function get_glosses(glosses: MultiString, metadata: ExportMetaData) {
  const { sense_index, position } = metadata
  const formatted_data: EntryForCSV = {}
  if (glosses) {
    Object.entries(glosses).forEach(([bcp, value]) => {
      formatted_data[`${count_sense(sense_index)}${bcp}_gloss`] = position === 'header'
        ? `${get_readable_sense(sense_index)}${glossingLanguages[bcp].vernacularName || bcp} Gloss`
        : value
    })
  }
  return formatted_data
}

export function get_semantic_domain(semantic_domains: string[], metadata: ExportMetaData) {
  const { sense_index, position } = metadata
  const formatted_data: EntryForCSV = {}
  if (semantic_domains) {
    for (let index = 0; index < semantic_domains.length; index++) {
      formatted_data[`${count_sense(sense_index)}semanticDomain${count_index(index)}`] = position === 'header'
        ? `${get_readable_sense(sense_index)}Semantic domain ${index + 1}`
        : semantic_domains[index]
    }
  }
  return formatted_data
}

export function get_parts_of_speech(parts_of_speech_abbreviations: string[], parts_of_speech: string[], metadata: ExportMetaData) {
  const { sense_index, position } = metadata
  const formatted_data: EntryForCSV = {}
  if (parts_of_speech) {
    for (let index = 0; index < parts_of_speech_abbreviations.length; index++) {
      formatted_data[`${count_sense(sense_index)}partOfSpeech${count_index(index)}`] = position === 'header'
        ? `${get_readable_sense(sense_index)}Part of speech ${index + 1} (abbreviation)`
        : parts_of_speech_abbreviations[index]
      formatted_data[`${count_sense(sense_index)}partOfSpeech fullname${count_index(index)}`] = position === 'header'
        ? `${get_readable_sense(sense_index)}Part of speech ${index + 1}`
        : parts_of_speech[index]
    }
  }
  return formatted_data
}

export function get_example_sentence(
  sentence: EntryData['senses'][0]['sentences'][0],
  metadata: ExportMetaData & { dictionary_id: string },
) {
  const { sense_index, position } = metadata
  const formatted_data: EntryForCSV = {}
  if (sentence?.text) {
    formatted_data[`${count_sense(sense_index)}vernacular_exampleSentence`] = position === 'header'
      ? `${get_readable_sense(sense_index)}Example sentence in ${metadata.dictionary_id}`
      : sentence.text?.default
  }
  if (sentence?.translation) {
    Object.keys(sentence?.translation).forEach((bcp) => {
      formatted_data[`${count_sense(sense_index)}${bcp}_exampleSentence`] = position === 'header'
        ? `${get_readable_sense(sense_index)}Example sentence in ${glossingLanguages[bcp].vernacularName || bcp}`
        : sentence.translation?.[bcp]
    })
  }

  return formatted_data
}

export function get_image_files(image_storage_path: string, metadata: ExportMetaData, entry: DeepPartial<ReturnType<typeof translate_entries>[0]> = null) {
  const { sense_index, position } = metadata
  const formatted_data: EntryForCSV = {}

  if (image_storage_path) {
    formatted_data[`${count_sense(sense_index)}photoFile`] = position === 'value' && entry
      ? friendlyName(entry as unknown as EntryData, image_storage_path)
      : `${get_readable_sense(sense_index)}Image filename`
    formatted_data[`${count_sense(sense_index)}photoSource`] = position === 'header'
      ? `${get_readable_sense(sense_index)}Source of image`
      : image_storage_path
  }

  return formatted_data
}

export function get_noun_class(noun_class: string, metadata: ExportMetaData) {
  const { sense_index, position } = metadata
  const formatted_data: EntryForCSV = {}
  if (noun_class) {
    formatted_data[`${count_sense(sense_index)}nounClass`] = position === 'header'
      ? `${get_readable_sense(sense_index)}Noun class`
      : noun_class
  }
  return formatted_data
}

export function get_variant(variant: MultiString, metadata: ExportMetaData) {
  const { sense_index, position } = metadata
  const formatted_data: EntryForCSV = {}
  if (variant?.default) {
    formatted_data[`${count_sense(sense_index)}variant`] = position === 'header'
      ? `${get_readable_sense(sense_index)}Variant`
      : variant.default
  }
  return formatted_data
}

export function get_plural_form(plural_form: MultiString, metadata: ExportMetaData) {
  const { sense_index, position } = metadata
  const formatted_data: EntryForCSV = {}
  if (plural_form?.default) {
    formatted_data[`${count_sense(sense_index)}pluralForm`] = position === 'header'
      ? `${get_readable_sense(sense_index)}Plural form`
      : plural_form.default
  }
  return formatted_data
}
