import { authState } from 'sveltefirets'
import { get } from 'svelte/store'
import type { ContentUpdateRequestBody, TablesUpdate } from '@living-dictionaries/types'
import { page } from '$app/stores'
import { invalidate } from '$app/navigation'
import { ENTRY_UPDATED_LOAD_TRIGGER } from '$lib/dbOperations'
import { post_request } from '$lib/helpers/get-post-requests'
import type { ContentUpdateResponseBody } from '$api/db/content-update/+server'

export async function update_sense({
  sense,
  entry_id,
  sense_id,
}: {
  sense: TablesUpdate<'senses'>
  entry_id: string
  sense_id: string
}) {
  try {
    const auth_state_user = get(authState)
    const auth_token = await auth_state_user.getIdToken()

    const { params: { dictionaryId: dictionary_id } } = get(page)

    const { error } = await post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>('/api/db/content-update', {
      auth_token,
      update_id: window.crypto.randomUUID(),
      dictionary_id,
      entry_id,
      sense_id,
      type: 'upsert_sense',
      data: sense,
      timestamp: new Date().toISOString(),
    })

    if (error)
      throw new Error(error.message)

    await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}
