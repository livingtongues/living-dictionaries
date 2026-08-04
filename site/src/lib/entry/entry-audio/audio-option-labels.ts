export interface AudioOptionInput {
  id: string
  storage_path: string
  speaker_name: string | null
}

export interface AudioOption {
  id: string
  storage_path: string
  /** Speaker name, or the recording's 1-based position when no speaker is attached (deliberately unlocalized). */
  label: string
  /** Quiet ordinal appended to duplicate speaker names ('1', '2', …); null when the name is unique. */
  ordinal: string | null
  no_speaker: boolean
}

/** Name-only labels for the speaker chooser — never any other speaker profile metadata. */
export function audio_option_labels(audios: AudioOptionInput[]): AudioOption[] {
  const name_counts = new Map<string, number>()
  for (const { speaker_name } of audios) {
    if (speaker_name)
      name_counts.set(speaker_name, (name_counts.get(speaker_name) ?? 0) + 1)
  }
  const seen = new Map<string, number>()
  return audios.map(({ id, storage_path, speaker_name }, index) => {
    if (!speaker_name)
      return { id, storage_path, label: String(index + 1), ordinal: null, no_speaker: true }
    const nth = (seen.get(speaker_name) ?? 0) + 1
    seen.set(speaker_name, nth)
    const is_duplicate = name_counts.get(speaker_name) > 1
    return { id, storage_path, label: speaker_name, ordinal: is_duplicate ? String(nth) : null, no_speaker: false }
  })
}

/** Adapt `EntryData.audios` (already `created_at ASC`) to the chooser's input shape. */
export function from_entry_audios(audios: { id: string, storage_path: string, speakers?: { name?: string | null }[] }[] | undefined | null): AudioOptionInput[] {
  return (audios ?? []).map(audio => ({
    id: audio.id,
    storage_path: audio.storage_path,
    speaker_name: audio.speakers?.[0]?.name || null,
  }))
}

if (import.meta.vitest) {
  const input = ({ id, name }: { id: string, name?: string | null }): AudioOptionInput =>
    ({ id, storage_path: `dict/audio/${id}.mp3`, speaker_name: name ?? null })

  describe(audio_option_labels, () => {
    it('unique names get no ordinal', () => {
      const options = audio_option_labels([input({ id: 'a', name: 'Rosa Lopez' }), input({ id: 'b', name: 'Sam Brown' })])
      expect(options.map(({ label, ordinal }) => ({ label, ordinal }))).toEqual([
        { label: 'Rosa Lopez', ordinal: null },
        { label: 'Sam Brown', ordinal: null },
      ])
    })

    it('duplicate names get quiet 1-based ordinals in order; unique names in the same set stay clean', () => {
      const options = audio_option_labels([
        input({ id: 'a', name: 'Sam Brown' }),
        input({ id: 'b', name: 'Norma Meza' }),
        input({ id: 'c', name: 'Sam Brown' }),
        input({ id: 'd', name: 'Sam Brown' }),
      ])
      expect(options.map(({ label, ordinal }) => `${label}${ordinal ? ` ${ordinal}` : ''}`)).toEqual([
        'Sam Brown 1',
        'Norma Meza',
        'Sam Brown 2',
        'Sam Brown 3',
      ])
    })

    it('missing speaker falls back to the bare 1-based position number', () => {
      const options = audio_option_labels([input({ id: 'a', name: 'Rosa Lopez' }), input({ id: 'b' }), input({ id: 'c' })])
      expect(options[1]).toEqual({ id: 'b', storage_path: 'dict/audio/b.mp3', label: '2', ordinal: null, no_speaker: true })
      expect(options[2].label).toBe('3')
      expect(options[0].no_speaker).toBe(false)
    })

    it('handles the empty list', () => {
      expect(audio_option_labels([])).toEqual([])
    })
  })

  describe(from_entry_audios, () => {
    it('takes the first attached speaker name and preserves order', () => {
      expect(from_entry_audios([
        { id: 'a', storage_path: 'p/a.mp3', speakers: [{ name: 'Rosa Lopez' }, { name: 'Second Speaker' }] },
        { id: 'b', storage_path: 'p/b.mp3', speakers: [] },
        { id: 'c', storage_path: 'p/c.mp3' },
      ])).toEqual([
        { id: 'a', storage_path: 'p/a.mp3', speaker_name: 'Rosa Lopez' },
        { id: 'b', storage_path: 'p/b.mp3', speaker_name: null },
        { id: 'c', storage_path: 'p/c.mp3', speaker_name: null },
      ])
    })

    it('tolerates missing audios', () => {
      expect(from_entry_audios(undefined)).toEqual([])
      expect(from_entry_audios(null)).toEqual([])
    })
  })
}
