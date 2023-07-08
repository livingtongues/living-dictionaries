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

export function format_semantic_domains(
  entry: ExpandedEntry,
): EntryForCSV {
  const domains = {};
  for (const [index, domain] of (entry.senses?.[0].semantic_domains || []).entries())
    domains[`semantic_domain_${index + 1}`] = domain;
  return domains;
}

export function format_gloss_languages(
  entry: ExpandedEntry,
): EntryForCSV {
  const gloss_languages = {};
  for (const [bcp, value] of Object.entries(entry.senses?.[0].glosses || {}))
    gloss_languages[`${bcp}_gloss_language`] = value
  return gloss_languages;
}

export function format_example_sentences(
  entry: ExpandedEntry,
): EntryForCSV {
  const example_sentences: EntryForCSV = {};
  for (const [bcp, value] of Object.entries(entry.senses?.[0].example_sentences?.[0] || {})) {
    if (bcp === 'vn')
      example_sentences.vernacular_example_sentence = value;
    else
      example_sentences[`${bcp}_example_sentence`] = value;
  }
  return example_sentences;
}
