import type { ExpandedEntry, ISpeaker, IPartOfSpeech } from '@living-dictionaries/types';
import type { EntryForCSV } from './prepareEntriesForCsv';

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

export function format_local_orthographies(
  entry: ExpandedEntry,
  local_orthographies_headers: EntryForCSV
): EntryForCSV {
  const formatted_local_orthographies = {};
  Object.keys(local_orthographies_headers).forEach((header) => {
    formatted_local_orthographies[local_orthographies_headers[header]] = entry[header] || '';
  });
  return formatted_local_orthographies;
}

export function format_semantic_domains(
  entry: ExpandedEntry,
  max_semantic_domain_number: number
): EntryForCSV {
  const formatted_semantic_domains = {};
  for (let index = 0; index < max_semantic_domain_number; index++) {
    formatted_semantic_domains[`semantic_domain_${index + 1}`] =
      entry.senses?.[0].semantic_domains?.[index] || '';
  }
  return formatted_semantic_domains;
}

export function format_gloss_languages(
  entry: ExpandedEntry,
  gloss_languages: string[]
): EntryForCSV {
  const formatted_gloss_languages = {};
  gloss_languages.forEach((bcp) => {
    formatted_gloss_languages[`${bcp}_gloss_language`] = entry.senses?.[0].glosses[bcp] || '';
  });
  return formatted_gloss_languages;
}

export function format_example_sentences(
  entry: ExpandedEntry,
  gloss_languages: string[]
): EntryForCSV {
  const formatted_example_sentences = {};
  formatted_example_sentences['vernacular_example_sentence'] =
    entry.senses?.[0].example_sentences?.[0].vn || '';
  gloss_languages.forEach((bcp) => {
    formatted_example_sentences[`${bcp}_example_sentence`] =
      entry.senses?.[0].example_sentences?.[0][bcp] || '';
  });
  return formatted_example_sentences;
}
