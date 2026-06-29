import type { DictionariesIdApiKeysKeyIdDeleteResponseBody } from './+server'
import { ResponseCodes } from '$lib/constants'

export async function api_delete_api_key({ dictionary_id, key_id }: { dictionary_id: string, key_id: string }) {
  try {
    const response = await fetch(`/api/dictionaries/${dictionary_id}/api-keys/${key_id}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
    })
    if (response.status !== ResponseCodes.OK) {
      const message = await response.text()
      return { data: null, error: { status: response.status, message } }
    }
    const data = await response.json() as DictionariesIdApiKeysKeyIdDeleteResponseBody
    return { data, error: null }
  } catch (err) {
    return { data: null, error: { status: 0, message: (err as Error).message } }
  }
}
