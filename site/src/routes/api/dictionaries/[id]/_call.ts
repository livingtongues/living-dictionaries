import type { DictionariesIdDeleteResponseBody, DictionariesIdGetResponseBody } from './+server'
import { ResponseCodes } from '$lib/constants'

export async function api_dictionaries_id_exists(dict_id: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/dictionaries/${dict_id}`)
    if (!response.ok) return false
    const { exists } = await response.json() as DictionariesIdGetResponseBody
    return exists
  } catch {
    return false
  }
}

export async function api_dictionaries_id_delete({ dict_id }: { dict_id: string }) {
  try {
    const response = await fetch(`/api/dictionaries/${dict_id}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
    })
    if (response.status !== ResponseCodes.OK) {
      const message = await response.text()
      return { data: null, error: { status: response.status, message } }
    }
    const data = await response.json() as DictionariesIdDeleteResponseBody
    return { data, error: null }
  } catch (err) {
    return { data: null, error: { status: 0, message: (err as Error).message } }
  }
}
