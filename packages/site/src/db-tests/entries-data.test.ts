// `pnpm -F site test:db entries-data`
import { get as getStore } from 'svelte/store'
import type { Database } from '@living-dictionaries/types'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_API_URL, SUPABASE_SERVICE_ROLE_KEY } from './clients'
import { postgres } from '$lib/mocks/seed/postgres'
import { create_entries_data_store } from '$lib/supabase/entries-data-store'

vi.mock('$app/environment', () => {
  return {
    browser: true,
  }
})

let cached_data: any[] = []

vi.mock('idb-keyval', () => {
  return {
    set: vi.fn((key: string, value: any[]) => {
      cached_data = value
    }),
    get: vi.fn((_key: string) => {
      return cached_data?.length ? cached_data : undefined
    }),
  }
})

function incremental_consistent_uuid(index: number) {
  return '22222222-2222-2222-2222-222222222222'.slice(0, -6) + (index).toString().padStart(6, '0')
}

const reset_db_sql = `truncate table auth.users cascade;`

function wait_for_entries_data(_entries_data: ReturnType<typeof create_entries_data_store>) {
  return new Promise((r) => {
    const unsub = _entries_data.loading.subscribe((loading) => {
      if (!loading) {
        r('loaded')
        unsub()
      }
    })
  })
}

describe(create_entries_data_store, () => {
  const supabase = createClient<Database>(PUBLIC_SUPABASE_API_URL, PUBLIC_SUPABASE_ANON_KEY)

  const USER_1_ID = incremental_consistent_uuid(0) // crypto.randomUUID()
  const USER_1_EMAIL = `user1-${USER_1_ID}@test.com`
  const USER_2_ID = incremental_consistent_uuid(1)
  const USER_2_EMAIL = `user2-${USER_2_ID}@test.com`
  const PASSWORD = 'password123'
  const dictionary_id = incremental_consistent_uuid(1) // crypto.randomUUID()
  const ENTRY_1_ID = incremental_consistent_uuid(0)
  const ENTRY_2_ID = incremental_consistent_uuid(1)
  const SENSE_1_ID = incremental_consistent_uuid(0)
  const PHOTO_1_ID = incremental_consistent_uuid(0)

  beforeAll(async () => {
    await postgres.execute_query(reset_db_sql)
    const admin_supabase = createClient<Database>(PUBLIC_SUPABASE_API_URL, SUPABASE_SERVICE_ROLE_KEY)

    await admin_supabase.auth.admin.createUser({
      // @ts-expect-error
      id: USER_1_ID,
      email: USER_1_EMAIL,
      password: PASSWORD,
      email_confirm: true,
    })
    await admin_supabase.auth.admin.createUser({
      // @ts-expect-error
      id: USER_2_ID,
      email: USER_2_EMAIL,
      password: PASSWORD,
      email_confirm: true,
    })
  })

  beforeEach(() => {
    cached_data = []
  })

  test('manager can add a dictionary, entry, and sense', async () => {
    await supabase.auth.signInWithPassword({ email: USER_1_EMAIL, password: PASSWORD })
    await supabase.from('dictionaries').insert({
      id: dictionary_id,
      url: dictionary_id,
      name: 'Test Dictionary',
    })
    const entries_data = create_entries_data_store({ dictionary_id, supabase })
    await wait_for_entries_data(entries_data)
    await entries_data.entries.insert({
      id: ENTRY_1_ID,
      lexeme: { default: 'lexeme 1' },
      dictionary_id,
    })
    await entries_data.senses.insert({
      id: SENSE_1_ID,
      entry_id: ENTRY_1_ID,
      dictionary_id,
    })
    const $entries_data = getStore(entries_data)
    expect($entries_data).toHaveLength(1)
    expect($entries_data[0].senses).toHaveLength(1)
  })

  test('manager can add an audio file to first entry', async () => {
    await supabase.auth.signInWithPassword({ email: USER_1_EMAIL, password: PASSWORD })
    const entries_data = create_entries_data_store({ dictionary_id, supabase })
    await wait_for_entries_data(entries_data)
    await entries_data.audios.insert({
      id: incremental_consistent_uuid(0),
      dictionary_id,
      entry_id: ENTRY_1_ID,
      storage_path: 'audio/1.mp3',
    })
    const $entries_data = getStore(entries_data)
    expect($entries_data[0].audios).toHaveLength(1)
    const $store_error = getStore(entries_data.error)
    expect($store_error).toBe(null)
  })

  test('manager can add a speaker to first entry audio', async () => {
    await supabase.auth.signInWithPassword({ email: USER_1_EMAIL, password: PASSWORD })
    const entries_data = create_entries_data_store({ dictionary_id, supabase })
    await wait_for_entries_data(entries_data)
    await entries_data.speakers.insert({
      id: incremental_consistent_uuid(0),
      dictionary_id,
      name: 'Speaker 1',
    })
    await entries_data.audio_speakers.insert({
      audio_id: ENTRY_1_ID,
      speaker_id: ENTRY_1_ID,
      dictionary_id,
    })
    const $entries_data = getStore(entries_data)
    expect($entries_data[0].audios[0].speakers).toHaveLength(1)
    const $store_error = getStore(entries_data.error)
    expect($store_error).toBe(null)
  })

  test('manager can add a tag and dialect to first entry', async () => {
    await supabase.auth.signInWithPassword({ email: USER_1_EMAIL, password: PASSWORD })
    const entries_data = create_entries_data_store({ dictionary_id, supabase })
    await wait_for_entries_data(entries_data)
    await entries_data.tags.insert({
      id: incremental_consistent_uuid(0),
      dictionary_id,
      name: 'Tag 1',
    })
    await entries_data.entry_tags.insert({
      entry_id: ENTRY_1_ID,
      tag_id: ENTRY_1_ID,
      dictionary_id,
    })
    await entries_data.dialects.insert({
      id: incremental_consistent_uuid(0),
      dictionary_id,
      name: { default: 'Dialect 1' },
    })
    await entries_data.entry_dialects.insert({
      entry_id: ENTRY_1_ID,
      dialect_id: ENTRY_1_ID,
      dictionary_id,
    })
    const $entries_data = getStore(entries_data)
    expect($entries_data[0].tags).toHaveLength(1)
    expect($entries_data[0].dialects).toHaveLength(1)
    const $store_error = getStore(entries_data.error)
    expect($store_error).toBe(null)
  })

  test('manager can add a photo and video to first entry sense', async () => {
    await supabase.auth.signInWithPassword({ email: USER_1_EMAIL, password: PASSWORD })
    const entries_data = create_entries_data_store({ dictionary_id, supabase })
    await wait_for_entries_data(entries_data)
    await entries_data.photos.insert({
      id: PHOTO_1_ID,
      dictionary_id,
      storage_path: 'photos/1.jpg',
      serving_url: 'https://example.com/1.jpg',
    })
    await entries_data.sense_photos.insert({
      sense_id: SENSE_1_ID,
      photo_id: PHOTO_1_ID,
      dictionary_id,
    })
    const video_id = incremental_consistent_uuid(0)
    await entries_data.videos.insert({
      id: video_id,
      dictionary_id,
      storage_path: 'videos/1.mp4',
    })
    await entries_data.sense_videos.insert({
      sense_id: SENSE_1_ID,
      video_id,
      dictionary_id,
    })
    const $entries_data = getStore(entries_data)
    expect($entries_data[0].senses[0].photos).toHaveLength(1)
    expect($entries_data[0].senses[0].videos).toHaveLength(1)
    const $store_error = getStore(entries_data.error)
    expect($store_error).toBe(null)
  })

  test('manager can and another photo and remove the first photo from the first entry sense', async () => {
    await supabase.auth.signInWithPassword({ email: USER_1_EMAIL, password: PASSWORD })
    const entries_data = create_entries_data_store({ dictionary_id, supabase })
    await wait_for_entries_data(entries_data)
    await entries_data.photos.insert({
      id: incremental_consistent_uuid(1),
      dictionary_id,
      storage_path: 'photos/2.jpg',
      serving_url: 'https://example.com/2.jpg',
    })
    await entries_data.sense_photos.insert({
      sense_id: SENSE_1_ID,
      photo_id: incremental_consistent_uuid(1),
      dictionary_id,
    })
    await entries_data.sense_photos.update({
      sense_id: SENSE_1_ID,
      photo_id: PHOTO_1_ID,
      deleted: new Date().toISOString(),
    })
    const $entries_data = getStore(entries_data)
    expect($entries_data[0].senses[0].photos).toHaveLength(1)
    const $store_error = getStore(entries_data.error)
    expect($store_error).toBe(null)
  })

  test('manager can add a sentence to first entry sense', async () => {
    await supabase.auth.signInWithPassword({ email: USER_1_EMAIL, password: PASSWORD })
    const entries_data = create_entries_data_store({ dictionary_id, supabase })
    await wait_for_entries_data(entries_data)
    const sentence_id = incremental_consistent_uuid(0)
    await entries_data.sentences.insert({
      id: sentence_id,
      dictionary_id,
      text: { default: 'This is a test sentence.' },
    })
    await entries_data.senses_in_sentences.insert({
      sense_id: SENSE_1_ID,
      sentence_id,
      dictionary_id,
    })
    const $entries_data = getStore(entries_data)
    expect($entries_data[0].senses[0].sentences).toHaveLength(1)
    const $store_error = getStore(entries_data.error)
    expect($store_error).toBe(null)
  })

  test('manager can add another entry and additional sense to first entry', async () => {
    await supabase.auth.signInWithPassword({ email: USER_1_EMAIL, password: PASSWORD })
    const entries_data = create_entries_data_store({ dictionary_id, supabase })
    await wait_for_entries_data(entries_data)
    await entries_data.entries.insert({
      id: ENTRY_2_ID,
      lexeme: { default: 'lexeme 2' },
      dictionary_id,
    })
    await entries_data.senses.insert({
      id: incremental_consistent_uuid(2),
      entry_id: ENTRY_1_ID,
      dictionary_id,
    })
    const $entries_data = getStore(entries_data)
    expect($entries_data).toHaveLength(2)
    expect($entries_data[0].senses).toHaveLength(2)
    const $store_error = getStore(entries_data.error)
    expect($store_error).toBe(null)
  })

  // test('peek at result', async () => {
  //   const entries_data = create_entries_data_store({ dictionary_id, supabase })
  //   await wait_for_entries_data(entries_data)
  //   const $entries_data = getStore(entries_data)
  //   expect($entries_data).toMatchFileSnapshot('entries-data.json')
  // })

  test('manager can delete second entry', async () => {
    await supabase.auth.signInWithPassword({ email: USER_1_EMAIL, password: PASSWORD })
    const entries_data = create_entries_data_store({ dictionary_id, supabase, log: false })
    await wait_for_entries_data(entries_data)
    await entries_data.entries.update({
      id: ENTRY_2_ID,
      deleted: new Date().toISOString(),
    })
    const $entries_data = getStore(entries_data)
    expect($entries_data).toHaveLength(1)
    const $store_error = getStore(entries_data.error)
    expect($store_error).toBe(null)
  })
})
