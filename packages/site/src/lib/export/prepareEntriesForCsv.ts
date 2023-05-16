import type {
  ExpandedEntry,
  IDictionary,
  IPartOfSpeech,
  ISemanticDomain,
  ISpeaker,
} from '@living-dictionaries/types';
import { stripHTMLTags } from './stripHTMLTags';
import { glossingLanguages } from '$lib/glosses/glossing-languages';

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
  vernacular_example_sentence?: string;
  va?: string; // optional for Babanki & Torwali
}

export function assign_local_orthographies_to_headers(
  headers: EntryForCSV,
  alternate_orthographies: string[]
): void {
  if (alternate_orthographies) {
    alternate_orthographies.forEach((lo, index) => {
      headers[`local_orthography_${index + 1}`] = lo;
    });
  }
}

export function assign_semantic_domains_to_headers(
  headers: EntryForCSV,
  max_semantic_domain_number: number
): void {
  if (max_semantic_domain_number > 0) {
    for (let index = 0; index < max_semantic_domain_number; index++) {
      headers[`semantic_domain_${index + 1}`] = `Semantic domain ${index + 1}`;
    }
  }
}

export function count_maximum_semantic_domains_only_from_first_senses(
  entries: ExpandedEntry[]
): number {
  const max_semantic_domain_number = Math.max(
    ...entries.map((entry) => entry.senses?.[0]?.semantic_domains?.length || 0)
  );
  return max_semantic_domain_number;
}

export function assign_gloss_languages_to_headers(
  headers: EntryForCSV,
  gloss_languages: string[]
): void {
  if (gloss_languages) {
    gloss_languages.forEach((bcp) => {
      headers[`${bcp}_gloss_language`] = `${glossingLanguages[bcp].vernacularName || bcp} Gloss`;
    });
  }
}

export function assign_example_sentences_to_headers(
  headers: EntryForCSV,
  gloss_languages: string[],
  dictionary_name: string
): void {
  headers.vernacular_example_sentence = `Example sentence in ${dictionary_name}`;
  if (gloss_languages) {
    gloss_languages.forEach((bcp) => {
      headers[`${bcp}_example_sentence`] = `Example sentence in ${
        glossingLanguages[bcp].vernacularName || bcp
      }`;
    });
  }
}

export function find_part_of_speech(
  parts_of_speech: IPartOfSpeech[],
  part_of_speech_abbreviation: string
): string {
  const part_of_speech = parts_of_speech.find(
    (part_of_speech) => part_of_speech.enAbbrev === part_of_speech_abbreviation
  );
  return part_of_speech ? part_of_speech.enName : '';
}

export function prepareEntriesForCsv(
  expanded_entries: ExpandedEntry[],
  dictionary: IDictionary,
  speakers: ISpeaker[],
  global_semantic_domains: ISemanticDomain[],
  parts_of_speech: IPartOfSpeech[]
): EntryForCSV[] {
  const max_semantic_domain_number =
    count_maximum_semantic_domains_only_from_first_senses(expanded_entries);
  const headers = {} as EntryForCSV;
  for (const key in StandardEntryCSVFields) {
    headers[key] = StandardEntryCSVFields[key];
  }
  // Begin dynamic headers
  assign_local_orthographies_to_headers(headers, dictionary.alternateOrthographies);
  assign_semantic_domains_to_headers(headers, max_semantic_domain_number);
  assign_gloss_languages_to_headers(headers, dictionary.glossLanguages);
  assign_example_sentences_to_headers(headers, dictionary.glossLanguages, dictionary.name);

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
      parts_of_speech_abbreviation: entry.senses?.[0]?.parts_of_speech?.[0] || '',
      parts_of_speech: find_part_of_speech(
        parts_of_speech,
        entry.senses?.[0]?.parts_of_speech?.[0]
      ),
      sound_filename: '',
      speaker_name: '',
      speaker_birthplace: '',
      speaker_decade: '',
      speaker_gender: '',
      image_filename: '',
    } as EntryForCSV;

    //Extract a function
    if (dictionary.alternateOrthographies) {
      const local_orthographies_of_entry = Object.keys(entry).filter((key) =>
        key.startsWith('local_orthography')
      );
      local_orthographies_of_entry.forEach((local_orthography) => {
        formattedEntry[headers[local_orthography]] = entry[local_orthography];
      });
    }
    //Extract a function
    for (let index = 0; index < max_semantic_domain_number; index++) {
      formattedEntry[`semantic_domain_${index + 1}`] = '';
      if (entry.senses?.[0].semantic_domains) {
        const matching_domain = global_semantic_domains.find(
          (sd) => sd.key === entry.senses?.[0].semantic_domains[index]
        );
        if (matching_domain) {
          formattedEntry[`semantic_domain_${index + 1}`] = matching_domain.name;
        }
      }
    }
    //Extract a function
    dictionary.glossLanguages.forEach((bcp) => {
      formattedEntry[`${bcp}_gloss_language`] = entry.senses?.[0].glosses[bcp] || '';
    });
    //Extract a function
    formattedEntry.vernacular_example_sentence = entry.senses?.[0].example_sentences?.[0].vn || '';
    dictionary.glossLanguages.forEach((bcp) => {
      formattedEntry[`${bcp}_example_sentence`] =
        entry.senses?.[0].example_sentences?.[0][bcp] || '';
    });

    return formattedEntry;
  });
  return [headers, ...formattedEntries];
}
