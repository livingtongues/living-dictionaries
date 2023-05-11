import type {
  ExpandedEntry,
  IDictionary,
  IPartOfSpeech,
  ISemanticDomain,
  ISpeaker,
} from '@living-dictionaries/types';
import { stripHTMLTags } from './stripHTMLTags';

enum StandardEntryCSVFields {
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
  sound_filename = 'Audio filename',
  speaker_name = 'Speaker name',
  speaker_birthplace = 'Speaker birthplace',
  speaker_decade = 'Speaker decade',
  speaker_gender = 'Speaker gender',
  image_filename = 'Image filename',
}
type EntryForCSVKeys = keyof typeof StandardEntryCSVFields;
type StandardEntryForCSV = {
  [key in EntryForCSVKeys]?: string;
};

export interface EntryForCSV extends StandardEntryForCSV {
  xsvn?: string;
  va?: string; // optional for Babanki & Torwali
}

export function assign_local_orthographies_to_headers(
  headers: EntryForCSV,
  alternate_orthographies: string[]
): void {
  if (alternate_orthographies) {
    alternate_orthographies.forEach((lo, index) => {
      headers[`local_orthographies_${index + 1}`] = lo;
    });
  }
}

export function assign_total_semantic_domains_from_first_sense(
  headers: EntryForCSV,
  entries: ExpandedEntry[]
): void {
  const maxSDN = Math.max(
    ...entries.map((entry) => entry.senses?.[0]?.semantic_domains?.length || 0)
  );
  if (maxSDN > 0) {
    for (let index = 0; index < maxSDN; index++) {
      headers[`semantic_domain_${index + 1}`] = `Semantic domain ${index + 1}`;
    }
  }
}

export function prepareEntriesForCsv(
  expanded_entries: ExpandedEntry[],
  dictionary: IDictionary,
  speakers: ISpeaker[],
  semantic_domains: ISemanticDomain[],
  parts_of_speech: IPartOfSpeech[]
): EntryForCSV[] {
  const headers = {} as EntryForCSV;
  for (const key in StandardEntryCSVFields) {
    headers[key] = StandardEntryCSVFields[key];
  }
  const formattedEntries: EntryForCSV[] = expanded_entries.map((entry) => {
    const formattedEntry = {
      id: entry.id || '',
      lexeme: entry.lexeme || '',
      phonetic: entry.phonetic || '',
      interlinearization: entry.interlinearization || '',
      noun_class: entry.senses?.[0]?.noun_class || '',
      morphology: entry.morphology || '',
      plural_form: entry.plural_form || '',
      dialects: entry.dialects?.[0] || '',
      notes: stripHTMLTags(entry.notes),
      sources: entry.sources?.join(' | ') || '', // some dictionaries (e.g. Kalanga) have sources that are strings and not arrays
      parts_of_speech_abbreviation: '',
      parts_of_speech: '',
      sound_filename: '',
      speaker_name: '',
      speaker_birthplace: '',
      speaker_decade: '',
      speaker_gender: '',
      image_filename: '',
    } as EntryForCSV;

    // Begin dynamic headers
    assign_local_orthographies_to_headers(headers, dictionary.alternateOrthographies);
    assign_total_semantic_domains_from_first_sense(headers, expanded_entries);
    return formattedEntry;
  });
  return [headers, ...formattedEntries];
}
