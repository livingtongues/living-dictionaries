import { apiFetch } from '$lib/client/apiFetch';
import { authState } from 'sveltefirets';
import { get } from 'svelte/store';
import { page } from '$app/stores';
import type { ChangeEntryRequestBody } from './types';
import { invalidate } from '$app/navigation';
import { ENTRY_UPDATED_LOAD_TRIGGER } from '$lib/dbOperations';

type SenseColumns = 'glosses' | 'parts_of_speech' | 'semantic_domains' | 'write_in_semantic_domains' | 'noun_class' | 'definition_english_deprecated' | 'deleted'

export async function updateSense({new_value, old_value, entry_id, column, sense_id }: {new_value: string, old_value?: string, entry_id: string, column: SenseColumns, sense_id: string }) {
  try {
    const auth_state_user = get(authState);
    const auth_token = await auth_state_user.getIdToken();

    const { params: { dictionaryId } } = get(page)

    const response = await apiFetch<ChangeEntryRequestBody>('/api/db/change/entry', {
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

    if (response.status !== 200) {
      const body = await response.json();
      throw new Error(body.message);
    }

    await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)
  } catch (err) {
    alert(err);
    console.error(err);
  }
}
