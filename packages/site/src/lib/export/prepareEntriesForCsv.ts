import type {
  ExpandedEntry,
  IDictionary,
  IPartOfSpeech,
  ISemanticDomain,
  ISpeaker,
} from '@living-dictionaries/types';
import type { IEntryForCSV } from './formatEntries';

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

export function prepareEntriesForCsv(
  expanded_entries: ExpandedEntry[],
  dictionary: IDictionary,
  speakers: ISpeaker[],
  semantic_domains: ISemanticDomain[],
  parts_of_speech: IPartOfSpeech[]
): IEntryForCSV[] {
  throw new Error('Function not implemented.');
}
