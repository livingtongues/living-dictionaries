import type { TablesUpdate } from '@living-dictionaries/types'
import { anon_supabase } from '../../config-supabase'
import { reset_local_db } from '../../reset-local-db'
import { jacob_ld_user_id } from '../../constants'
import { assign_dialect, assign_speaker, insert_dialect, insert_entry, insert_photo, insert_sense, insert_sentence, insert_video, upsert_audio, upsert_speaker } from './operations'
import { dictionary_id } from './constants'
import { test_timestamp } from './test-timestamp'

vi.mock('node:crypto', () => {
  const uuid_template = '11111111-1111-1111-1111-111111111111'
  let current_uuid_index = 0

  function incremental_consistent_uuid() {
    return uuid_template.slice(0, -2) + (current_uuid_index++).toString().padStart(2, '0')
  }

  return {
    randomUUID: incremental_consistent_uuid,
  }
})

const import_id = '1'

async function seed_entry_and_sense() {
  const { data } = await insert_entry({ dictionary_id, entry: { lexeme: { default: 'hi' } }, entry_id: '1', import_id })
  const { data: sense_data } = await insert_sense({ dictionary_id, entry_id: data.entry_id, sense: { glosses: { en: 'hello' } }, import_id })
  return { entry_id: data.entry_id, sense_id: sense_data.sense_id }
}

describe('entries and senses', () => {
  beforeAll(reset_local_db)

  describe(insert_entry, () => {
    test('adds entry, adds sense, and deletes sense', async () => {
      const lexeme = { default: 'hi' }
      const { data } = await insert_entry({ dictionary_id, entry: { lexeme }, import_id, entry_id: '1' })
      expect(data?.import_id).toEqual('1')
      const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', data.entry_id).single()
      expect(entry_view.dictionary_id).toEqual(dictionary_id)
      expect(entry_view.dictionary_id).toEqual(dictionary_id)
      expect(entry_view.main.lexeme).toEqual(lexeme)
      expect(entry_view.senses).toBeNull()
      const glosses = { en: 'hello' }
      const { data: sense_save } = await insert_sense({ dictionary_id, entry_id: data.entry_id, sense: {
        glosses,
      }, import_id: '1' })
      const { data: entry_view2 } = await anon_supabase.from('entries_view').select().eq('id', data.entry_id).single()
      expect(entry_view2.senses[0].glosses).toEqual(glosses)

      await insert_sense({ dictionary_id, entry_id: data.entry_id, sense: { deleted: 'true' }, sense_id: sense_save.sense_id, import_id })
      const { data: entry_view3 } = await anon_supabase.from('entries_view').select().eq('id', data.entry_id).single()
      expect(entry_view3.senses).toBeNull()
    })
  })
})

describe(insert_dialect, () => {
  beforeAll(reset_local_db)

  test('adds to dialects table, edits dialect, and connects to entry', async () => {
    const name = 'Eastern'
    const { data } = await insert_dialect({ dictionary_id, name, import_id, user_id: jacob_ld_user_id, timestamp: test_timestamp })
    expect(data?.import_id).toEqual('1')
    const { data: dialect } = await anon_supabase.from('dialects').select('*').eq('id', data.dialect_id).single()
    expect(dialect.name.default).toEqual(name)
    expect(dialect.dictionary_id).toEqual(dictionary_id)

    const edited_name = 'Western'
    await insert_dialect({ dictionary_id, name: edited_name, dialect_id: data.dialect_id, import_id, user_id: jacob_ld_user_id, timestamp: test_timestamp })
    const { data: edited_dialect } = await anon_supabase.from('dialects').select('name').eq('id', data.dialect_id).single()
    expect(edited_dialect.name.default).toEqual(edited_name)

    const { entry_id } = await seed_entry_and_sense()
    await assign_dialect({ dictionary_id, dialect_id: data.dialect_id, entry_id, import_id, user_id: jacob_ld_user_id, timestamp: test_timestamp })
    const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
    expect(entry_view.dialect_ids).toEqual([data.dialect_id])
  })
})

describe(upsert_audio, () => {
  beforeAll(reset_local_db)

  test('adds audio and displays properly in view', async () => {
    const { entry_id } = await seed_entry_and_sense()

    const audio: TablesUpdate<'audio'> = {
      created_at: '2019-08-27T05:06:40.796Z',
      // created_by: 'Wr77x8C4e0PI3TMqOnJnJ7VmlLF3',
      entry_id,
      id: 'use-crypto-uuid-in-real-thing_2',
      source: 'javier domingo',
      storage_path: 'audio/dict_80CcDQ4DRyiYSPIWZ9Hy/0DyO0JQrRUVXPvVNLEyN_1566882399481.mpeg',
      updated_at: '2019-08-27T05:06:40.796Z',
      // updated_by: 'Wr77x8C4e0PI3TMqOnJnJ7VmlLF3',
    }
    await upsert_audio({ dictionary_id, entry_id, audio, import_id: '1' })

    const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
    expect(entry_view.audios[0].source).toEqual(audio.source)
    expect(entry_view.audios[0].storage_path).toEqual(audio.storage_path)
  })
})

describe(insert_sentence, () => {
  beforeAll(reset_local_db)

  test('adds sentence and links to sense', async () => {
    const { entry_id, sense_id } = await seed_entry_and_sense()
    const { data } = await insert_sentence({ dictionary_id, sense_id, sentence: { text: { default: 'hello, this is my sentence' } }, import_id: '1' })

    const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
    expect(entry_view.senses[0].sentence_ids).toEqual([data.sentence_id])
  })
})

describe(insert_photo, () => {
  beforeAll(reset_local_db)

  test('adds photo and links to sense', async () => {
    const { entry_id, sense_id } = await seed_entry_and_sense()
    const storage_path = 'bee/images/baz.jpeg'
    const { data } = await insert_photo({ dictionary_id, photo: { serving_url: 'foo', source: 'Bob', storage_path }, sense_id })

    const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
    expect(entry_view.senses[0].photo_ids).toEqual([data.photo_id])
    const { data: photo } = await anon_supabase.from('photos').select().eq('id', data.photo_id).single()
    expect(photo.storage_path).toEqual(storage_path)
  })
})

describe(insert_video, () => {
  beforeAll(reset_local_db)

  test('adds video and links to sense', async () => {
    const { entry_id, sense_id } = await seed_entry_and_sense()
    const { data } = await insert_video({ dictionary_id, video: { source: 'Bob', storage_path: 'baz.wbm' }, sense_id })

    const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
    expect(entry_view.senses[0].video_ids).toEqual([data.video_id])
  })
})

describe(upsert_speaker, () => {
  beforeAll(reset_local_db)

  test('adds speaker to audio and to video', async () => {
    const { entry_id, sense_id } = await seed_entry_and_sense()
    const { data: speaker_change } = await upsert_speaker({ dictionary_id, speaker: { name: 'Bob', created_at: test_timestamp, created_by: jacob_ld_user_id }, import_id })

    const { data: audio_change } = await upsert_audio({ dictionary_id, entry_id, audio: { storage_path: 'foo.mp3' } })
    await assign_speaker({ dictionary_id, speaker_id: speaker_change.speaker_id, media_id: audio_change.audio_id, media: 'audio', import_id, user_id: jacob_ld_user_id, timestamp: test_timestamp })

    const { data: video_change } = await insert_video({ dictionary_id, video: { source: 'Bob Family', storage_path: 'baz.wbm' }, sense_id })
    await assign_speaker({ dictionary_id, speaker_id: speaker_change.speaker_id, media_id: video_change.video_id, media: 'video', import_id, user_id: jacob_ld_user_id, timestamp: test_timestamp })

    const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
    expect(entry_view.audios[0].speaker_ids).toEqual([speaker_change.speaker_id])
    const { data: videos } = await anon_supabase.from('videos').select().eq('id', video_change.video_id).single()
    expect(videos.speaker_ids).toEqual([speaker_change.speaker_id])
  })
})

describe('entries have their updated_at timestamp updated whenever nested properties change', () => {
  beforeEach(reset_local_db)

  describe('values which are props', () => {
    test('audio', async () => {
      const { entry_id } = await seed_entry_and_sense()
      const { data: audio_change } = await upsert_audio({ dictionary_id, entry_id, audio: { storage_path: 'foo.mp3' } })
      const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
      expect(entry_view.updated_at).not.toEqual(entry_view.created_at)
      expect(entry_view.updated_at).toEqual(audio_change.timestamp)
    })

    test('sense', async () => {
      const { entry_id, sense_id } = await seed_entry_and_sense()
      const { data: sense_change } = await insert_sense({ dictionary_id, entry_id, sense_id, sense: { glosses: { en: 'hi, again' } }, import_id })
      const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
      expect(entry_view.updated_at).toEqual(sense_change.timestamp)
    })

    test('dialect ids', async () => {
      const { entry_id } = await seed_entry_and_sense()
      const { data: dialect_addition } = await insert_dialect({ dictionary_id, name: 'Eastern', import_id, user_id: jacob_ld_user_id, timestamp: test_timestamp })
      const { data: dialect_assign } = await assign_dialect({ dictionary_id, dialect_id: dialect_addition.dialect_id, entry_id, import_id, user_id: jacob_ld_user_id, timestamp: test_timestamp })
      const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
      console.log({ entry_view, dialect_addition, dialect_assign })
      expect(entry_view.updated_at).toEqual(dialect_assign.timestamp)
    })
  })

  describe('id-related fields', () => {
    test('sentence', async () => {
      const { entry_id, sense_id } = await seed_entry_and_sense()
      const { data: sentence_change } = await insert_sentence({ dictionary_id, sense_id, sentence: { text: { default: 'hi, this is my sentence' } } })
      const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
      expect(entry_view.updated_at).toEqual(sentence_change.timestamp)
    })

    test('photo', async () => {
      const { entry_id, sense_id } = await seed_entry_and_sense()
      const { data: photo_change } = await insert_photo({ dictionary_id, photo: { serving_url: 'foo', source: 'Bob', storage_path: 'bee/images/baz.jpeg' }, sense_id })
      const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
      expect(entry_view.updated_at).toEqual(photo_change.timestamp)
    })

    test('video', async () => {
      const { entry_id, sense_id } = await seed_entry_and_sense()
      const { data: video_change } = await insert_video({ dictionary_id, video: { source: 'Bob', storage_path: 'baz.wbm' }, sense_id })
      const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
      expect(entry_view.updated_at).toEqual(video_change.timestamp)
    })
  })
})
