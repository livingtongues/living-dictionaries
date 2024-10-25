import type {
  EntryView,
} from '@living-dictionaries/types'
// import { friendlyName } from './friendlyName'
// import {
//   get_example_sentence_headers,
//   get_gloss_language_headers,
//   get_local_orthography_headers,
//   get_semantic_domain_headers,
// } from './assignHeadersForCsv'

export enum StandardEntryCSVFields {
  id = 'Entry Id',
  lexeme = 'Lexeme/Word/Phrase',
  phonetic = 'Phonetic (IPA)',
  interlinearization = 'Interlinearization',
  noun_class = 'Noun class',
  morphology = 'Morphology',
  plural_form = 'Plural form',
  dialects = 'Dialects',
  notes = 'Notes',
  sources = 'Source(s)',
  parts_of_speech_abbreviation = 'Part of Speech abbreviation',
  parts_of_speech = 'Part of Speech',
  image_filename = 'Image filename',
  sound_filename = 'Audio filename',
  speaker_name = 'Speaker name',
  speaker_birthplace = 'Speaker birthplace',
  speaker_decade = 'Speaker decade',
  speaker_gender = 'Speaker gender',
}
export type EntryForCSVKeys = keyof typeof StandardEntryCSVFields
type StandardEntryForCSV = {
  [key in EntryForCSVKeys]?: string;
}

export type EntryForCSV = StandardEntryForCSV & Omit<EntryView, 'dialects' | 'sources'> & {
  vernacular_example_sentence?: string
  variant?: string // for DICTIONARIES_WITH_VARIANTS
}

// export function getCsvHeaders(expanded_entries: EntryView[], { alternateOrthographies, glossLanguages, name: dictionaryName }: IDictionary): EntryForCSV {
//   const headers: EntryForCSV = { ...StandardEntryCSVFields }

//   const has_variants = expanded_entries.some(entry => entry.variant)
//   if (has_variants)
//     headers.variant = 'Variant'

//   return {
//     ...headers,
//     ...get_local_orthography_headers(alternateOrthographies),
//     ...get_semantic_domain_headers(expanded_entries),
//     ...get_gloss_language_headers(glossLanguages),
//     ...get_example_sentence_headers(glossLanguages, dictionaryName),
//   }
// }

// export function formatCsvEntries(
//   entries: EntryView[],
//   speakers: Tables<'speakers'>[],
//   global_parts_of_speech: IPartOfSpeech[],
// ): EntryForCSV[] {
//   return entries.map((entry) => {
//     const speaker = get_first_speaker_from_first_sound_file(entry, speakers)

//     const formatted_entry = {
//       ...entry,
//       noun_class: entry.senses?.[0]?.noun_class,
//       dialects: entry.dialects?.[0],
//       notes: stripHTMLTags(entry.notes),
//       sources: entry.sources?.join(' | '),
//       parts_of_speech_abbreviation: find_part_of_speech_abbreviation(
//         global_parts_of_speech,
//         entry.senses?.[0]?.translated_parts_of_speech?.[0],
//       ),
//       parts_of_speech: entry.senses?.[0]?.translated_parts_of_speech?.[0],
//       image_filename: friendlyName(entry, entry.senses?.[0].photo_files?.[0]?.fb_storage_path),
//       sound_filename: friendlyName(entry, entry.sound_files?.[0]?.fb_storage_path),
//       speaker_name: speaker?.displayName,
//       speaker_birthplace: speaker?.birthplace,
//       speaker_decade: decades[speaker?.decade],
//       speaker_gender: display_speaker_gender(speaker?.gender),
//     } satisfies EntryForCSV

//     return {
//       ...formatted_entry,
//       ...format_semantic_domains(entry),
//       ...format_gloss_languages(entry),
//       ...format_example_sentences(entry),
//     }
//   })
// }
