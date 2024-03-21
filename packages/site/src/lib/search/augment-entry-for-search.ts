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
  return {
    ...entry,
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
