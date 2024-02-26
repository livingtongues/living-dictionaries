import { authState } from 'sveltefirets';
import { get } from 'svelte/store';
import { page } from '$app/stores';
import { invalidate } from '$app/navigation';
import { ENTRY_UPDATED_LOAD_TRIGGER } from '$lib/dbOperations';
import { post_request } from '$lib/helpers/get-post-requests';
import type { Database } from '../database.types';
import type { ChangeSentenceRequestBody, ChangeSentenceResponseBody } from '$api/db/change/sentence/+server';

export async function update_sentence({new_value, old_value, sentence_id, column, sense_id }: {new_value: string, old_value?: string, sentence_id: string, column: Database['public']['Enums']['sentence_columns'], sense_id: string }) {
  try {
    const auth_state_user = get(authState);
    const auth_token = await auth_state_user.getIdToken();

    const { params: { dictionaryId } } = get(page)

    const { error } = await post_request<ChangeSentenceRequestBody, ChangeSentenceResponseBody>('/api/db/change/entry', {
      auth_token,
      id: window.crypto.randomUUID(),
      dictionary_id: dictionaryId,
      sentence_id,
      sense_id,
      table: 'sentences',
      column,
      new_value,
      old_value,
      timestamp: new Date().toISOString(),
    });

    if (error)
      throw new Error(error.message);

    await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)
  } catch (err) {
    alert(err);
    console.error(err);
  }
}
