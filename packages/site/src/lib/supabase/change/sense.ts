import { authState } from 'sveltefirets';
import { get } from 'svelte/store';
import { page } from '$app/stores';
import { invalidate } from '$app/navigation';
import { ENTRY_UPDATED_LOAD_TRIGGER } from '$lib/dbOperations';
import { post_request } from '$lib/helpers/get-post-requests';
import type { ChangeEntryRequestBody, ChangeEntryResponseBody } from '$api/db/change/entry/+server';
import type { Database } from '../database.types';

export async function updateSense({new_value, old_value, entry_id, column, sense_id }: {new_value: string, old_value?: string, entry_id: string, column: Database['public']['Enums']['entry_columns'], sense_id: string }) {
  try {
    const auth_state_user = get(authState);
    const auth_token = await auth_state_user.getIdToken();

    const { params: { dictionaryId } } = get(page)

    const { error } = await post_request<ChangeEntryRequestBody, ChangeEntryResponseBody>('/api/db/change/entry', {
      auth_token,
      id: window.crypto.randomUUID(),
      dictionary_id: dictionaryId,
      entry_id,
      table: 'senses',
      column,
      row: sense_id,
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
