import type { ISpeaker } from '@living-dictionaries/types/speaker.interface'
import { anon_supabase } from '../config-supabase'
import { migrate_entries, migrate_speakers } from './migrate-entries'
import entries_to_test_264 from './entries_to_test.json'
import firebase_speakers from './speakers.json'
import { reset_db } from './reset-db'

vi.mock('node:crypto', () => {
  const uuid_template = '11111111-1111-1111-1111-111111111111'
  let current_uuid_index = 0

  function incremental_consistent_uuid() {
    return uuid_template.slice(0, -5) + (current_uuid_index++).toString().padStart(5, '0')
  }

  return {
    randomUUID: incremental_consistent_uuid,
  }
})

vi.mock('./test-timestamp', () => {
  return {
    test_timestamp: new Date('2024-03-08T00:44:04.600392+00:00').toISOString(),
  }
})

describe(migrate_entries, () => {
  beforeEach(reset_db)

  test.todo('works on all use cases', { timeout: 60000 }, async () => {
    const speakers = await migrate_speakers(firebase_speakers as ISpeaker[])
    await migrate_entries(entries_to_test_264, speakers)
    const { data: entry_view } = await anon_supabase.from('entries_view').select()
    expect(entry_view).toMatchFileSnapshot('view-after-migrating-entries.json')
  })

  test('write in speaker names are added but not duplicated and assigned', async () => {
    const speakerName = 'Write-in Speaker Name not in db'
    await migrate_entries([{
      id: 'custom-id-1',
      dictionary_id: 'create-me',
      lx: 'hi',
      sf: {
        path: 'foo.mp3',
        speakerName,
      },
    }, {
      id: 'custom-id-2',
      dictionary_id: 'create-me',
      lx: 'hello',
      sf: {
        path: 'food.mp3',
        speakerName,
      },
    }], {})

    const { data: entry_view } = await anon_supabase.from('entries_view').select()
    expect(entry_view[0].audios[0].speaker_ids[0]).toMatchInlineSnapshot(`"11111111-1111-1111-1111-111111100005"`)
    expect(entry_view[0].audios[0].speaker_ids[0]).toEqual(entry_view[1].audios[0].speaker_ids[0])

    const { data: speakers } = await anon_supabase.from('speakers_view').select()
    expect(speakers).toHaveLength(1)
    expect(speakers[0].name).toEqual(speakerName)
  })
})
