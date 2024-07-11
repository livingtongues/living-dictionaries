import { authState } from 'sveltefirets'
import { get } from 'svelte/store'
import { page } from '$app/stores'
import { invalidate } from '$app/navigation'
import { ENTRY_UPDATED_LOAD_TRIGGER } from '$lib/dbOperations'
import { post_request } from '$lib/helpers/get-post-requests'
import type { ContentUpdateRequestBody, ContentUpdateResponseBody } from '$api/db/content-update/+server'

export async function update_sense({ change, entry_id, sense_id }: { change: ContentUpdateRequestBody['change']['sense'], entry_id: string, sense_id: string }) {
  try {
    const auth_state_user = get(authState)
    const auth_token = await auth_state_user.getIdToken()

    const { params: { dictionaryId: dictionary_id } } = get(page)

    const { error } = await post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>('/api/db/content-update', {
      auth_token,
      id: window.crypto.randomUUID(),
      dictionary_id,
      entry_id,
      sense_id,
      table: 'senses',
      change: { sense: change },
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
