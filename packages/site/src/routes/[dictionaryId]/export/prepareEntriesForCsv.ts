import type {
  ExpandedEntry,
  IDictionary,
  IPartOfSpeech,
  ISpeaker,
} from '@living-dictionaries/types';
import { stripHTMLTags } from './stripHTMLTags';
import { friendlyName } from './friendlyName';
import {
  get_local_orthography_headers,
  get_example_sentence_headers,
  get_gloss_language_headers,
  get_semantic_domain_headers,
} from './assignHeadersForCsv';
import {
  find_part_of_speech_abbreviation,
  get_first_speaker_from_first_sound_file,
  display_speaker_gender,
  format_gloss_languages,
  format_example_sentences,
  format_semantic_domains,
} from './assignFormattedEntryValuesForCsv';
import { decades } from '$lib/components/media/ages';

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
export type EntryForCSVKeys = keyof typeof StandardEntryCSVFields;
type StandardEntryForCSV = {
  [key in EntryForCSVKeys]?: string;
};

export interface EntryForCSV extends StandardEntryForCSV {
  vernacular_example_sentence?: string;
  variant?: string; // for any dictionary with it, probably just babanki & torwali
  sound_file_path?: string; // for downloading file, not exported in CSV
  image_file_path?: string; // for downloading file, not exported in CSV
}

export function getCsvHeaders(expanded_entries: ExpandedEntry[], { alternateOrthographies, glossLanguages, name: dictionaryName}: IDictionary): EntryForCSV {
  const headers: EntryForCSV = { ...StandardEntryCSVFields };

  const has_variants = expanded_entries.some((entry) => entry.variant);
  if (has_variants)
    headers.variant = 'Variant';

  return {
    ...headers,
    ...get_local_orthography_headers(alternateOrthographies),
    ...get_semantic_domain_headers(expanded_entries),
    ...get_gloss_language_headers(glossLanguages),
    ...get_example_sentence_headers(glossLanguages, dictionaryName),
  };
}

export function formatCsvEntries(
  expanded_entries: ExpandedEntry[],
  speakers: ISpeaker[],
  global_parts_of_speech: IPartOfSpeech[]
): EntryForCSV[] {
  return expanded_entries.map((entry) => {
    const formatted_entry = {
      ...entry,
      noun_class: entry.senses?.[0]?.noun_class,
      dialects: entry.dialects?.[0],
      notes: stripHTMLTags(entry.notes),
      sources: entry.sources?.join(' | '),
      parts_of_speech_abbreviation: find_part_of_speech_abbreviation(
        global_parts_of_speech,
        entry.senses?.[0]?.parts_of_speech?.[0]
      ),
      parts_of_speech: entry.senses?.[0]?.parts_of_speech?.[0],
      image_filename: friendlyName(entry, entry.senses?.[0].photo_files?.[0].fb_storage_path),
      sound_filename: friendlyName(entry, entry.sound_files?.[0].fb_storage_path),
    } as EntryForCSV;

    //Begin dynamic values
    formatted_entry.image_file_path = entry.senses?.[0].photo_files?.[0].fb_storage_path;
    const speaker = get_first_speaker_from_first_sound_file(entry, speakers);
    formatted_entry.sound_file_path = entry.sound_files?.[0].fb_storage_path;
    formatted_entry.speaker_name = speaker?.displayName;
    formatted_entry.speaker_birthplace = speaker?.birthplace;
    formatted_entry.speaker_decade = decades[speaker?.decade];
    formatted_entry.speaker_gender = display_speaker_gender(speaker?.gender);

    return {
      ...formatted_entry,
      ...format_semantic_domains(entry),
      ...format_gloss_languages(entry),
      ...format_example_sentences(entry),
    };
  });
}
