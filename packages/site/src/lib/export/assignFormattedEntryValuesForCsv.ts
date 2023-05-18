import type {
  ExpandedEntry,
  ISpeaker,
  ISemanticDomain,
  IPartOfSpeech,
} from '@living-dictionaries/types';
import type { EntryForCSV } from './prepareEntriesForCsv';

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
