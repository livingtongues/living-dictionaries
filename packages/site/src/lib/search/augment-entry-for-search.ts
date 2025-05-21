import type { EntryData } from '@living-dictionaries/types'

export function augment_entry_for_search(entry: EntryData) {
  const senses = entry.senses || []

  const _tags = (entry.tags || []).map(({ name }) => name).filter(Boolean)
  const _dialects = (entry.dialects || []).flatMap(({ name }) => Object.values(name)).filter(Boolean)
  const _parts_of_speech = senses.map(sense => sense.parts_of_speech || []).flat()
  const _semantic_domains = senses.map(sense => [...(sense.semantic_domains || []), ...(sense.write_in_semantic_domains || [])]).flat()
  const _speakers = (entry.audios || []).flatMap(audio => audio.speakers || []).map(({ name }) => name).filter(Boolean)

  const _lexeme = Object.entries(entry.main.lexeme)
    .sort(([key_a], [key_b]) => {
      if (key_a === 'default') return -1
      if (key_b === 'default') return 1
      return key_a.localeCompare(key_b)
    })
    .map(([_, lexeme]) => lexeme)
    .filter(Boolean)

  const _glosses = senses.flatMap(sense => Object.values(sense.glosses || {}).filter(Boolean))

  const sentences = senses.flatMap(sense =>
    sense.sentences?.flatMap(({ text }) => Object.values(text).filter(Boolean)) || [],
  )
  const plural_forms = senses.flatMap(sense => Object.values(sense.plural_form || {}).filter(Boolean))

  const _other: string[] = [entry.main.phonetic, Object.values(entry.main.notes || {}), entry.main.scientific_names, entry.main.sources, entry.main.interlinearization, entry.main.morphology, plural_forms, entry.main.elicitation_id, sentences].flat().filter(Boolean)

  return {
    id: entry.id,
    _lexeme,
    _glosses,
    _other,
    _elicitation_id: entry.main.elicitation_id,
    // Filters
    _tags,
    _dialects,
    _speakers,
    _parts_of_speech: _parts_of_speech.map(use_underscores_for_spaces_periods),
    _semantic_domains: _semantic_domains.map(use_underscores_for_spaces_periods),
    has_audio: !!entry.audios?.length,
    has_sentence: !!entry.senses?.find(sense => sense.sentences?.length),
    has_image: !!entry.senses?.find(sense => sense.photos?.length),
    has_video: !!entry.senses?.find(sense => sense.videos?.length),
    has_speaker: !!_speakers.length,
    has_noun_class: !!entry.senses?.find(sense => sense.noun_class),
    has_plural_form: !!entry.senses?.find(sense => sense.plural_form),
    has_part_of_speech: !!entry.senses?.find(sense => sense.parts_of_speech?.length),
    has_semantic_domain: !!entry.senses?.find(sense => sense.semantic_domains?.length || sense.write_in_semantic_domains?.length),
  }
}

function use_underscores_for_spaces_periods(string: string) {
  return string
    .replace(/ /g, '_')
    .replace(/\./g, '__')
}

export function restore_spaces_periods_from_underscores(string: string) {
  return string
    .replace(/__/g, '.')
    .replace(/_/g, ' ')
}

const ipa_to_common_keyboard = {
  ɛ: 'e',
  ɘ: 'e',
  ǝ: 'e',
  ɪ: 'i',
  ɔ: 'o',
  ø: 'o',
  ɑ: 'a',
  æ: 'a',
  ʊ: 'u',
  ʃ: 's',
  ʒ: 'z',
  ʐ: 'z',
  ɡ: 'g',
  ɢ: 'g',
  ɣ: 'g',
  χ: 'x',
  ʡ: '?',
  ʔ: '?',
  ʕ: '?',
  ʁ: 'r',
  ɹ: 'r',
  ɚ: 'r',
  ð: 'd',
  ɖ: 'd',
  θ: 't',
  ʈ: 't',
  ʌ: 'v',
  ɱ: 'm',
  ŋ: 'n',
  ɲ: 'n',
  ɳ: 'n',
  ɴ: 'n',
  ʰ: 'h',
}

export function simplify_lexeme_for_search(lexeme: string) {
  if (!lexeme) return
  const simplified = lexeme?.normalize('NFD').replace(/[\u0300-\u036F]/g, '') // removes diacritics

  let result = ''
  for (const char of simplified)
    result += ipa_to_common_keyboard[char] || char

  if (result === lexeme) return
  return result
}
