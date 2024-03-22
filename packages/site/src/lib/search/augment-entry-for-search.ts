import type { ExpandedEntry } from '@living-dictionaries/types';

export function augment_entry_for_search(entry: ExpandedEntry) {
  const dialects = entry.dialects || []
  const parts_of_speech = entry.senses?.map(sense => sense.translated_parts_of_speech || []).flat() || []
  const semantic_domains = entry.senses?.map(sense => [...(sense.translated_ld_semantic_domains || []), ...(sense.write_in_semantic_domains || [])]).flat() || []
  const speakers = entry.sound_files?.map(audio => {
    if (audio.speaker_ids)
      return audio.speaker_ids
    if (audio.speakerName)
      return [audio.speakerName]
    return []}).flat() || []

  const lexeme_other = [
    entry.local_orthography_1,
    entry.local_orthography_2,
    entry.local_orthography_3,
    entry.local_orthography_4,
    entry.local_orthography_5,
    simplify_lexeme_for_search(entry.lexeme),
  ].filter(Boolean);

  const glosses = entry.senses?.flatMap(sense => Object.values(sense.glosses || {}).filter(Boolean)) || [];
  const sentences = entry.senses?.flatMap(sense =>
    sense.example_sentences?.flatMap(sentence => Object.values(sentence).filter(Boolean)) || []
  ) || [];

  return {
    ...entry,
    lexeme_other,
    glosses,
    sentences,
    // Filters
    dialects: dialects.map(use_underscores_for_spaces),
    parts_of_speech: parts_of_speech.map(use_underscores_for_spaces),
    semantic_domains: semantic_domains.map(use_underscores_for_spaces),
    speakers: speakers.map(use_underscores_for_spaces),
    has_audio: !!entry.sound_files?.length,
    has_image: !!entry.senses?.find(sense => sense.photo_files?.length),
    has_video: !!entry.senses?.find(sense => sense.video_files?.length),
    has_speaker: !!speakers.length,
    has_noun_class: !!entry.senses?.find(sense => sense.noun_class),
    has_plural_form: !!entry.plural_form,
    has_part_of_speech: !!entry.senses?.find(sense => sense.parts_of_speech_keys?.length),
    has_semantic_domain: !!entry.senses?.find(sense => sense.ld_semantic_domains_keys?.length || sense.write_in_semantic_domains?.length),
  }
}

function use_underscores_for_spaces(string: string) {
  return string.replace(/ /g, '_')
}

export function restore_spaces_from_underscores(string: string) {
  return string.replace(/_/g, ' ')
}

const ipa_to_common_keyboard = {
  'ɛ': 'e',
  'ɘ': 'e',
  'ǝ': 'e',
  'ɪ': 'i',
  'ɔ': 'o',
  'ø': 'o',
  'ɑ': 'a',
  'æ': 'a',
  'ʊ': 'u',
  'ʃ': 's',
  'ʒ': 'z',
  'ʐ': 'z',
  'ɡ': 'g',
  'ɢ': 'g',
  'ɣ': 'g',
  'χ': 'x',
  'ʡ': '?',
  'ʔ': '?',
  'ʕ': '?',
  'ʁ': 'r',
  'ɹ': 'r',
  'ɚ': 'r',
  'ð': 'd',
  'ɖ': 'd',
  'θ': 't',
  'ʈ': 't',
  'ʌ': 'v',
  'ɱ': 'm',
  'ŋ': 'n',
  'ɲ': 'n',
  'ɳ': 'n',
  'ɴ': 'n',
  'ʰ': 'h',
}

export function simplify_lexeme_for_search(lexeme: string) {
  if (!lexeme) return;
  const simplified = lexeme?.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // removes diacritics

  let result = '';
  for (const char of simplified)
    result += ipa_to_common_keyboard[char] || char;

  if (result === lexeme) return;
  return result;
}
