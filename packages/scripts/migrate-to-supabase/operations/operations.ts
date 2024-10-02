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
