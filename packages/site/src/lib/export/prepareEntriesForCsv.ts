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
  image_filename = 'Image filename',
  sound_filename = 'Audio filename',
  speaker_name = 'Speaker name',
  speaker_birthplace = 'Speaker birthplace',
  speaker_decade = 'Speaker decade',
  speaker_gender = 'Speaker gender',
}
type EntryForCSVKeys = keyof typeof StandardEntryCSVFields;
type StandardEntryForCSV = {
  [key in EntryForCSVKeys]?: string;
};

export interface EntryForCSV extends StandardEntryForCSV {
  vernacular_example_sentence?: string;
  variant?: string; // optional for Babanki & Torwali
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

export function get_first_speaker_from_first_sound_file(
  entry: ExpandedEntry,
  speakers: ISpeaker[]
): ISpeaker {
  return speakers.find((speaker) => speaker.id === entry.sound_files?.[0].speaker_ids?.[0]);
}

export function display_speaker_gender(speaker_gender: string): string {
  if (speaker_gender) {
    return speaker_gender === 'f' ? 'female' : 'male';
  }
  return '';
}

export function display_speaker_age_range(decade: number) {
  switch (decade) {
    case 0:
      return '0-10';
    case 1:
      return '11-20';
    case 2:
      return '21-30';
    case 3:
      return '31-40';
    case 4:
      return '41-50';
    case 5:
      return '51-60';
    case 6:
      return '61-70';
    case 7:
      return '71-80';
    case 8:
      return '81-90';
    case 9:
      return '91-100';
    default:
      return '';
  }
}
type LocalOrthographiesAllocator = {
  formatted_entry: EntryForCSV;
  headers: EntryForCSV;
  entry: ExpandedEntry;
  alternate_orthographies: string[];
};
export function assign_local_orthographies_to_formatted_entry(
  allocator: LocalOrthographiesAllocator
): void {
  const { formatted_entry, headers, entry, alternate_orthographies } = allocator;
  if (alternate_orthographies) {
    const local_orthographies_of_headers = Object.keys(headers).filter((key) =>
      key.startsWith('local_orthography')
    );
    local_orthographies_of_headers.forEach((header) => {
      formatted_entry[headers[header]] = entry[header] || '';
    });
  }
}

type SemanticDomainsAllocator = {
  formatted_entry: EntryForCSV;
  entry: ExpandedEntry;
  max_semantic_domain_number: number;
  global_semantic_domains: ISemanticDomain[];
};
export function assign_semantic_domains_to_formatted_entry(
  allocator: SemanticDomainsAllocator
): void {
  const { formatted_entry, entry, max_semantic_domain_number, global_semantic_domains } = allocator;
  for (let index = 0; index < max_semantic_domain_number; index++) {
    formatted_entry[`semantic_domain_${index + 1}`] = '';
    if (entry.senses?.[0].semantic_domains) {
      const matching_domain = global_semantic_domains.find(
        (sd) => sd.key === entry.senses?.[0].semantic_domains[index]
      );
      if (matching_domain) {
        formatted_entry[`semantic_domain_${index + 1}`] = matching_domain.name;
      }
    }
  }
}

type GlossesAllocator = {
  formatted_entry: EntryForCSV;
  entry: ExpandedEntry;
  gloss_languages: string[];
};
export function assign_gloss_languages_to_formatted_entry(allocator: GlossesAllocator): void {
  const { formatted_entry, entry, gloss_languages } = allocator;
  gloss_languages.forEach((bcp) => {
    formatted_entry[`${bcp}_gloss_language`] = entry.senses?.[0].glosses[bcp] || '';
  });
}

export function assign_example_sentences_to_formatted_entry(allocator: GlossesAllocator): void {
  const { formatted_entry, entry, gloss_languages } = allocator;
  formatted_entry.vernacular_example_sentence = entry.senses?.[0].example_sentences?.[0].vn || '';
  gloss_languages.forEach((bcp) => {
    formatted_entry[`${bcp}_example_sentence`] =
      entry.senses?.[0].example_sentences?.[0][bcp] || '';
  });
}

const dictionaries_with_variant = ['babanki', 'torwali'];

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

  // Dictionary specific
  if (dictionaries_with_variant.includes(dictionary.id)) {
    headers['variant'] = 'Variant';
  }

  const formattedEntries: EntryForCSV[] = expanded_entries.map((entry) => {
    const formatted_entry = {
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
      image_filename: entry.senses?.[0].photo_files?.[0].fb_storage_path || '',
      sound_filename: entry.sound_files?.[0].fb_storage_path || '',
    } as EntryForCSV;

    //Begin dynamic values
    // Dictionary specific
    if (dictionaries_with_variant.includes(dictionary.id)) {
      formatted_entry.variant = entry.variant || '';
    }

    assign_local_orthographies_to_formatted_entry({
      formatted_entry,
      headers,
      entry,
      alternate_orthographies: dictionary.alternateOrthographies,
    });

    assign_semantic_domains_to_formatted_entry({
      formatted_entry,
      entry,
      max_semantic_domain_number,
      global_semantic_domains,
    });

    assign_gloss_languages_to_formatted_entry({
      formatted_entry,
      entry,
      gloss_languages: dictionary.glossLanguages,
    });

    assign_example_sentences_to_formatted_entry({
      formatted_entry,
      entry,
      gloss_languages: dictionary.glossLanguages,
    });

    const speaker = get_first_speaker_from_first_sound_file(entry, speakers);
    formatted_entry.speaker_name = speaker?.displayName || '';
    formatted_entry.speaker_birthplace = speaker?.birthplace || '';
    formatted_entry.speaker_decade = display_speaker_age_range(speaker?.decade);
    formatted_entry.speaker_gender = display_speaker_gender(speaker?.gender);

    return formatted_entry;
  });
  return [headers, ...formattedEntries];
}
