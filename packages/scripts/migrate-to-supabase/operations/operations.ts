import { randomUUID } from 'node:crypto'
import type { ContentUpdateRequestBody, TablesUpdate } from '@living-dictionaries/types'
import type { ContentUpdateResponseBody } from '../../../site/src/routes/api/db/content-update/+server'
import { jacob_ld_user_id } from '../../config-supabase'
import { post_request } from '../../import/post-request'
import { content_update_endpoint, timestamp } from './constants'

export function upsert_entry({
  dictionary_id,
  entry,
  entry_id,
  import_id,
}: {
  dictionary_id: string
  entry: TablesUpdate<'entries'>
  entry_id?: string
  import_id?: string
}) {
  return post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
    update_id: randomUUID(),
    auth_token: null,
    user_id_from_local: jacob_ld_user_id,
    dictionary_id,
    entry_id: entry_id || randomUUID(),
    type: 'upsert_entry',
    data: entry,
    import_id,
    timestamp,
  })
}

export function upsert_sense({
  dictionary_id,
  entry_id,
  sense,
  sense_id,
  import_id,
}: {
  dictionary_id: string
  entry_id: string
  sense: TablesUpdate<'senses'>
  sense_id?: string
  import_id?: string
}) {
  return post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
    update_id: randomUUID(),
    auth_token: null,
    user_id_from_local: jacob_ld_user_id,
    dictionary_id,
    entry_id,
    sense_id: sense_id || randomUUID(),
    type: 'upsert_sense',
    data: sense,
    import_id,
    timestamp,
  })
}

export function upsert_dialect({
  dictionary_id,
  name,
  dialect_id,
  import_id,
}: {
  dictionary_id: string
  name: string
  dialect_id?: string
  import_id?: string
}) {
  return post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
    update_id: randomUUID(),
    auth_token: null,
    user_id_from_local: jacob_ld_user_id,
    dictionary_id,
    dialect_id: dialect_id || randomUUID(),
    type: 'upsert_dialect',
    data: {
      name: {
        default: name,
      },
    },
    import_id,
    timestamp,
  })
}

export function assign_dialect({
  dictionary_id,
  dialect_id,
  entry_id,
  import_id,
}: {
  dictionary_id: string
  dialect_id: string
  entry_id: string
  import_id?: string
}) {
  return post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
    update_id: randomUUID(),
    auth_token: null,
    user_id_from_local: jacob_ld_user_id, // TODO: this needs to be set to the user who made the change in import
    dictionary_id,
    dialect_id,
    entry_id,
    type: 'assign_dialect',
    data: null,
    import_id,
    timestamp,
  })
}

export function upsert_speaker({
  dictionary_id,
  speaker,
  speaker_id,
  import_id,
}: {
  dictionary_id: string
  speaker: TablesUpdate<'speakers'>
  speaker_id?: string
  import_id?: string
}) {
  return post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
    update_id: randomUUID(),
    auth_token: null,
    user_id_from_local: jacob_ld_user_id,
    dictionary_id,
    speaker_id: speaker_id || randomUUID(),
    type: 'upsert_speaker',
    data: speaker,
    import_id,
    timestamp,
  })
}

export function assign_speaker({
  dictionary_id,
  speaker_id,
  media_id,
  media,
  import_id,
}: {
  dictionary_id: string
  speaker_id: string
  media_id: string
  media: 'audio' | 'video'
  import_id?: string
}) {
  return post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
    update_id: randomUUID(),
    auth_token: null,
    user_id_from_local: jacob_ld_user_id,
    dictionary_id,
    speaker_id,
    ...(media === 'audio' ? { audio_id: media_id } : { video_id: media_id }),
    type: 'assign_speaker',
    import_id,
    timestamp,
  })
}

export function upsert_audio({
  dictionary_id,
  audio,
  entry_id,
  audio_id,
  import_id,
}: {
  dictionary_id: string
  audio: TablesUpdate<'audio'>
  entry_id: string
  audio_id?: string
  import_id?: string
}) {
  return post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
    update_id: randomUUID(),
    auth_token: null,
    user_id_from_local: jacob_ld_user_id,
    dictionary_id,
    entry_id,
    audio_id: audio_id || randomUUID(),
    type: 'upsert_audio',
    data: audio,
    import_id,
    timestamp,
  })
}

export function upsert_sentence({
  dictionary_id,
  sense_id,
  sentence,
  sentence_id,
  import_id,
}: {
  dictionary_id: string
  sense_id: string
  sentence: TablesUpdate<'sentences'>
  sentence_id?: string
  import_id?: string
}) {
  return post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
    update_id: randomUUID(),
    auth_token: null,
    user_id_from_local: jacob_ld_user_id,
    dictionary_id,
    sentence_id: sentence_id || randomUUID(),
    sense_id,
    type: 'insert_sentence',
    data: sentence,
    import_id,
    timestamp,
  })
}

export function upsert_photo({
  dictionary_id,
  photo,
  sense_id,
  photo_id,
  import_id,
}: {
  dictionary_id: string
  photo: TablesUpdate<'photos'>
  sense_id: string
  photo_id?: string
  import_id?: string
}) {
  return post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
    update_id: randomUUID(),
    auth_token: null,
    user_id_from_local: jacob_ld_user_id,
    dictionary_id,
    sense_id,
    photo_id: photo_id || randomUUID(),
    type: 'upsert_photo',
    data: photo,
    import_id,
    timestamp,
  })
}

export function upsert_video({
  dictionary_id,
  video,
  sense_id,
  video_id,
  import_id,
}: {
  dictionary_id: string
  video: TablesUpdate<'videos'>
  sense_id: string
  video_id?: string
  import_id?: string
}) {
  return post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
    update_id: randomUUID(),
    auth_token: null,
    user_id_from_local: jacob_ld_user_id,
    dictionary_id,
    sense_id,
    video_id: video_id || randomUUID(),
    type: 'upsert_video',
    data: video,
    import_id,
    timestamp,
  })
}
