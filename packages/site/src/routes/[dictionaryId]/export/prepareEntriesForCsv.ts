import type {
  ExpandedEntry,
  IDictionary,
  IPartOfSpeech,
  ISpeaker,
} from '@living-dictionaries/types';
import { stripHTMLTags } from './stripHTMLTags';
import { friendlyName } from './friendlyName';
import {
  assign_local_orthographies_as_headers,
  assign_example_sentences_as_headers,
  assign_gloss_languages_as_headers,
  assign_semantic_domains_as_headers,
  count_maximum_semantic_domains_only_from_first_senses,
} from './assignHeadersForCsv';
import {
  find_part_of_speech_abbreviation,
  get_first_speaker_from_first_sound_file,
  display_speaker_gender,
  format_local_orthographies,
  format_semantic_domains,
  format_gloss_languages,
  format_example_sentences,
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
  variant?: string; // optional for Babanki & Torwali
  sound_file_path?: string; // for downloading file, not exported in CSV
  image_file_path?: string; // for downloading file, not exported in CSV
}

const dictionaries_with_variant = ['babanki', 'torwali'];

export function prepareEntriesForCsv(
  expanded_entries: ExpandedEntry[],
  dictionary: IDictionary,
  speakers: ISpeaker[],
  global_parts_of_speech: IPartOfSpeech[]
): EntryForCSV[] {
  const max_semantic_domain_number =
    count_maximum_semantic_domains_only_from_first_senses(expanded_entries);

  const default_headers: EntryForCSV = { ...StandardEntryCSVFields };

  // Begin dynamic headers
  const local_orthographies_headers = assign_local_orthographies_as_headers(
    dictionary.alternateOrthographies
  );
  const semantic_domains_headers = assign_semantic_domains_as_headers(max_semantic_domain_number);
  const gloss_languages_headers = assign_gloss_languages_as_headers(dictionary.glossLanguages);
  const example_sentences_headers = assign_example_sentences_as_headers(
    dictionary.glossLanguages,
    dictionary.name
  );

  // Dictionary specific
  if (dictionaries_with_variant.includes(dictionary.id)) {
    default_headers['variant'] = 'Variant';
  }

  const headers = {
    ...default_headers,
    ...local_orthographies_headers,
    ...semantic_domains_headers,
    ...gloss_languages_headers,
    ...example_sentences_headers,
  };

  const formattedEntries: EntryForCSV[] = expanded_entries.map((entry) => {
    const formatted_entry = {
      id: entry.id,
      lexeme: entry.lexeme,
      phonetic: entry.phonetic,
      interlinearization: entry.interlinearization,
      noun_class: entry.senses?.[0]?.noun_class,
      morphology: entry.morphology,
      plural_form: entry.plural_form,
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

    const formatted_local_orthographies = format_local_orthographies(
      entry,
      local_orthographies_headers
    );
    const formatted_semantic_domains = format_semantic_domains(entry, max_semantic_domain_number);

    const formatted_gloss_languages = format_gloss_languages(entry, dictionary.glossLanguages);

    const formatted_example_sentences = format_example_sentences(entry, dictionary.glossLanguages);

    // Dictionary specific
    if (dictionaries_with_variant.includes(dictionary.id)) {
      formatted_entry.variant = entry.variant;
    }

    return {
      ...formatted_entry,
      ...formatted_local_orthographies,
      ...formatted_semantic_domains,
      ...formatted_gloss_languages,
      ...formatted_example_sentences,
    };
  });
  return [headers, ...formattedEntries];
}
