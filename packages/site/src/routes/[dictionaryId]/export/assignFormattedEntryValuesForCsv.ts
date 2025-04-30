import type { EntryView, MultiString, Orthography, PartOfSpeech, Tables } from '@living-dictionaries/types'
import type { EntryForCSV } from './prepareEntriesForCsv'
import { get_example_sentence, get_glosses, get_image_files, get_noun_class, get_parts_of_speech, get_plural_form, get_semantic_domain, get_variant } from './getRows'

export function find_part_of_speech_abbreviation(global_parts_of_speech: PartOfSpeech[], part_of_speech: string): string {
  return global_parts_of_speech.find(({ enName }) => enName === part_of_speech)?.enAbbrev
}

export function get_first_speaker_from_first_sound_file(entry: EntryView, speakers: Tables<'speakers'>[]) {
  return speakers.find(speaker => speaker?.id === entry.audios?.[0].speaker_ids?.[0])
}

export function display_speaker_gender(speaker_gender: string): string {
  if (speaker_gender) return speaker_gender === 'f' ? 'female' : 'male'
}

export function format_orthographies(orthographies: Orthography[], lexeme: MultiString) {
  const formatted_data: EntryForCSV = {}
  if (orthographies?.length) {
    orthographies.forEach((_, index) => {
      formatted_data[`${index > 0 ? `localOrthography.${index + 1}` : 'localOrthography'}`] = lexeme[`lo${index + 1}`]
    })
  }
  return formatted_data
}

export function format_senses(entry: EntryView) {
  let formatted_senses = {}

  for (const [sense_index, sense] of Array.from(entry.senses).entries()) {
    formatted_senses = {
      ...formatted_senses,
      ...get_glosses(sense.glosses, { sense_index, position: 'value' }),
      ...get_semantic_domain(sense.semantic_domains, { sense_index, position: 'value' }),
      // @ts-ignore
      ...get_parts_of_speech(sense.parts_of_speech_abbreviations, sense.parts_of_speech, { sense_index, position: 'value' }),
      ...get_noun_class(sense.noun_class, { sense_index, position: 'value' }),
      ...get_variant(sense.variant, { sense_index, position: 'value' }),
      ...get_plural_form(sense.plural_form, { sense_index, position: 'value' }),
      // @ts-ignore
      ...get_image_files(sense.photo_urls?.[0], { sense_index, position: 'value' }, entry),
      // @ts-ignore
      ...get_example_sentence(sense.sentences?.[0], { sense_index, position: 'value' }),
    }
  }

  return formatted_senses
}
