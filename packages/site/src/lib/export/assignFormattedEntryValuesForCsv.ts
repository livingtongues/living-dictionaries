import type { ExpandedEntry, ISpeaker, IPartOfSpeech } from '@living-dictionaries/types';
import type { EntryForCSV } from './prepareEntriesForCsv';
import { decades } from '$lib/components/media/ages';

export function find_part_of_speech_abbreviation(
  global_parts_of_speech: IPartOfSpeech[],
  part_of_speech: string
): string {
  const part_of_speech_abbreviation = global_parts_of_speech.find(
    (pos) => pos.enName === part_of_speech
  );
  return part_of_speech_abbreviation ? part_of_speech_abbreviation.enAbbrev : '';
}

export function get_first_speaker_from_first_sound_file(
  entry: ExpandedEntry,
  speakers: ISpeaker[]
): ISpeaker {
  return speakers.find((speaker) => speaker?.id === entry.sound_files?.[0].speaker_ids?.[0]);
}

export function display_speaker_gender(speaker_gender: string): string {
  if (speaker_gender) {
    return speaker_gender === 'f' ? 'female' : 'male';
  }
  return '';
}

export function display_speaker_age_range(decade: number) {
  return decades[decade] || '';
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
};
export function assign_semantic_domains_to_formatted_entry(
  allocator: SemanticDomainsAllocator
): void {
  const { formatted_entry, entry, max_semantic_domain_number } = allocator;
  for (let index = 0; index < max_semantic_domain_number; index++) {
    formatted_entry[`semantic_domain_${index + 1}`] =
      entry.senses?.[0].semantic_domains?.[index] || '';
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
