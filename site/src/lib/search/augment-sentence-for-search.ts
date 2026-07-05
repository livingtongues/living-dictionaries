import type { Tables } from '$lib/types'

export interface SentenceSearchContext {
  audios: Tables<'audio'>[]
  photo_junctions: Tables<'sentence_photos'>[]
  video_junctions: Tables<'sentence_videos'>[]
}

/** Shape a `sentences` row into a sentence-index doc (see `sentences_index_schema`). */
export function augment_sentence_for_search(sentence: Tables<'sentences'>, { audios, photo_junctions, video_junctions }: SentenceSearchContext) {
  const _text = Object.values(sentence.text || {}).filter(Boolean)
  const _translation = Object.values(sentence.translation || {}).filter(Boolean)
  return {
    id: sentence.id,
    _text,
    _translation,
    _created_at: sentence.created_at,
    _text_id: sentence.text_id || null,
    _sort_key: sentence.sort_key || null,
    // Filters
    in_text: !!sentence.text_id,
    has_translation: !!_translation.length,
    has_audio: !!audios.length,
    has_image: !!photo_junctions.length,
    has_video: !!video_junctions.length,
    _sources: (sentence.sources || []).filter(Boolean),
  }
}

/** Shape a `texts` row into a text-index doc (see `texts_index_schema`). */
export function augment_text_for_search(text: Tables<'texts'>) {
  return {
    id: text.id,
    _title: Object.values(text.title || {}).filter(Boolean),
    _created_at: text.created_at,
  }
}

if (import.meta.vitest) {
  const base_sentence = {
    id: 's1',
    text: { default: 'Nak tore', lo2: 'nak toré' },
    translation: { en: 'Good morning' },
    text_id: null,
    sort_key: null,
    ends_paragraph: null,
    sources: ['bruce-1974'],
    tokens: null,
    created_at: '2026-07-05T00:00:00.000Z',
    updated_at: '2026-07-05T00:00:00.000Z',
  } as unknown as Tables<'sentences'>

  const empty_context: SentenceSearchContext = { audios: [], photo_junctions: [], video_junctions: [] }

  describe(augment_sentence_for_search, () => {
    test('standalone sentence with translation + source', () => {
      expect(augment_sentence_for_search(base_sentence, empty_context)).toEqual({
        id: 's1',
        _text: ['Nak tore', 'nak toré'],
        _translation: ['Good morning'],
        _created_at: '2026-07-05T00:00:00.000Z',
        _text_id: null,
        _sort_key: null,
        in_text: false,
        has_translation: true,
        has_audio: false,
        has_image: false,
        has_video: false,
        _sources: ['bruce-1974'],
      })
    })

    test('text sentence with media', () => {
      const sentence = { ...base_sentence, text_id: 't1', sort_key: 'a0', translation: null, sources: null } as unknown as Tables<'sentences'>
      const doc = augment_sentence_for_search(sentence, {
        audios: [{ id: 'a1' } as Tables<'audio'>],
        photo_junctions: [{ id: 'sp1' } as Tables<'sentence_photos'>],
        video_junctions: [],
      })
      expect(doc.in_text).toBe(true)
      expect(doc._text_id).toBe('t1')
      expect(doc.has_translation).toBe(false)
      expect(doc.has_audio).toBe(true)
      expect(doc.has_image).toBe(true)
      expect(doc.has_video).toBe(false)
      expect(doc._sources).toEqual([])
    })
  })

  describe(augment_text_for_search, () => {
    test('shapes title values', () => {
      const text = { id: 't1', title: { default: 'The Hunt', en: 'The Hunt (story)' }, created_at: '2026-07-05T00:00:00.000Z' } as unknown as Tables<'texts'>
      expect(augment_text_for_search(text)).toEqual({ id: 't1', _title: ['The Hunt', 'The Hunt (story)'], _created_at: '2026-07-05T00:00:00.000Z' })
    })
  })
}
