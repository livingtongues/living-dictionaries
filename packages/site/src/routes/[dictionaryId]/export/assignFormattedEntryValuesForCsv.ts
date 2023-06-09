import type { ExpandedEntry, ISpeaker, IPartOfSpeech } from '@living-dictionaries/types';
import type { EntryForCSV } from './prepareEntriesForCsv';

export function find_part_of_speech_abbreviation(
  global_parts_of_speech: IPartOfSpeech[],
  part_of_speech: string
): string {
  return global_parts_of_speech.find(({ enName }) => enName === part_of_speech)?.enAbbrev;
}

export function get_first_speaker_from_first_sound_file(
  entry: ExpandedEntry,
  speakers: ISpeaker[]
): ISpeaker {
  return speakers.find((speaker) => speaker?.id === entry.sound_files?.[0].speaker_ids?.[0]);
}

export function display_speaker_gender(speaker_gender: string): string {
  if (speaker_gender) return speaker_gender === 'f' ? 'female' : 'male';
}

export function format_local_orthographies(
  entry: ExpandedEntry,
  local_orthographies_headers: EntryForCSV
): EntryForCSV {
  const formatted_local_orthographies = {};
  for (const key of Object.keys(local_orthographies_headers)) {
    formatted_local_orthographies[key] = entry[key] ?? undefined;
  }
  return formatted_local_orthographies;
}

export function format_semantic_domains(
  entry: ExpandedEntry,
  max_semantic_domain_number: number
): EntryForCSV {
  const formatted_semantic_domains = {};
  for (let index = 0; index < max_semantic_domain_number; index++) {
    formatted_semantic_domains[`semantic_domain_${index + 1}`] =
      entry.senses?.[0].semantic_domains?.[index];
  }
  return formatted_semantic_domains;
}

export function format_gloss_languages(
  entry: ExpandedEntry,
  gloss_languages: string[]
): EntryForCSV {
  const formatted_gloss_languages = {};
  gloss_languages.forEach((bcp) => {
    formatted_gloss_languages[`${bcp}_gloss_language`] = entry.senses?.[0].glosses[bcp];
  });
  return formatted_gloss_languages;
}

export function format_example_sentences(
  entry: ExpandedEntry,
  gloss_languages: string[]
): EntryForCSV {
  const formatted_example_sentences = {};
  formatted_example_sentences['vernacular_example_sentence'] =
    entry.senses?.[0].example_sentences?.[0].vn;
  gloss_languages.forEach((bcp) => {
    formatted_example_sentences[`${bcp}_example_sentence`] =
      entry.senses?.[0].example_sentences?.[0][bcp];
  });
  return formatted_example_sentences;
}
