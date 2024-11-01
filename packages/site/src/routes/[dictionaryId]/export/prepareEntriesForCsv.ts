import type {
  EntryView,
  IDictionary,
  Tables,
} from '@living-dictionaries/types'
import { friendlyName } from './friendlyName'
import {
  get_example_sentence_headers,
  get_gloss_language_headers,
  get_local_orthography_headers,
  get_semantic_domain_headers,
} from './assignHeadersForCsv'
import { display_speaker_gender, get_first_speaker_from_first_sound_file } from './assignFormattedEntryValuesForCsv'
import { stripHTMLTags } from './stripHTMLTags'
import { decades } from '$lib/components/media/ages'

export enum StandardEntryCSVFields {
  id = 'Entry Id',
  lexeme = 'Lexeme/Word/Phrase',
  phonetic = 'Phonetic (IPA)',
  interlinearization = 'Interlinearization',
  morphology = 'Morphology',
  dialects = 'Dialects',
  notes = 'Notes',
  sources = 'Source(s)',
  noun_class = 'Noun class', // TODO: this is now part of senses
  plural_form = 'Plural form', // TODO: this is now part of senses
  parts_of_speech_abbreviation = 'Part of Speech abbreviation', // TODO: this is now part of senses and is string[]
  parts_of_speech = 'Part of Speech', // TODO: this is now part of senses and is string[]
  image_filename = 'Image filename', // TODO: part of the 1st sense, additional sense can not yet have media
  sound_source = 'Audio source',
  sound_filename = 'Audio filename',
  speaker_name = 'Speaker name',
  speaker_birthplace = 'Speaker birthplace',
  speaker_decade = 'Speaker decade',
  speaker_gender = 'Speaker gender',
}

export type EntryForCSVKeys = keyof typeof StandardEntryCSVFields

export type EntryForCSV = {
  [key in EntryForCSVKeys]?: string;
}

export function getCsvHeaders(entries: EntryView[], { alternateOrthographies, glossLanguages, name: dictionaryName }: IDictionary): EntryForCSV {
  const headers: EntryForCSV = { ...StandardEntryCSVFields }

  // TODO: variants are on senses so this is no longer a one-off column
  // const has_variants = entries.some(entry => entry.senses?.some(sense => sense.variant))
  // if (has_variants)
  //   headers.variant = 'Variant'

  return {
    ...headers,
    ...get_local_orthography_headers(alternateOrthographies),
    // TODO: these 3 are all part of senses now, so they will need reworked according to each sense
    ...get_semantic_domain_headers(entries),
    ...get_gloss_language_headers(glossLanguages),
    ...get_example_sentence_headers(glossLanguages, dictionaryName),
  }
}

export function formatCsvEntries(
  entries: EntryView[],
  speakers: Tables<'speakers_view'>[],
  url_from_storage_path: (path: string) => string,
): EntryForCSV[] {
  return entries.map((entry) => {
    const speaker = get_first_speaker_from_first_sound_file(entry, speakers)

    const formatted_entry = {
      ...entry,
      notes: stripHTMLTags(entry.main.notes?.default),
      sources: entry.main.sources?.join(' | '),
      sound_source: entry.audios ? url_from_storage_path(entry.audios?.[0]?.storage_path) : null, // TODO: use to pull audio down
      sound_filename: entry.audios ? friendlyName(entry, entry.audios?.[0]?.storage_path) : null, // TODO: goal filename for user to find in zip
      speaker_name: speaker?.name,
      speaker_birthplace: speaker?.birthplace,
      speaker_decade: decades[speaker?.decade],
      speaker_gender: display_speaker_gender(speaker?.gender),
    } satisfies EntryForCSV

    return {
      ...formatted_entry,
      // TODO: these are all part of senses now, so they will need reworked according to each sense
      // ...format_semantic_domains(entry),
      // ...format_gloss_languages(entry),
      // ...format_example_sentences(entry),
    }
  })
}
