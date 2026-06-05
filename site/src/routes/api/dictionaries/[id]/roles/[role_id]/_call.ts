import type { DictionariesIdRolesRoleIdDeleteResponseBody } from './+server'
import { ResponseCodes } from '$lib/constants'

export async function api_dictionaries_id_roles_role_id_delete({ dict_id, role_id }: { dict_id: string, role_id: string }) {
  try {
    const response = await fetch(`/api/dictionaries/${dict_id}/roles/${role_id}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
    })
    if (response.status !== ResponseCodes.OK) {
      const message = await response.text()
      return { data: null, error: { status: response.status, message } }
    }
    const data = await response.json() as DictionariesIdRolesRoleIdDeleteResponseBody
    return { data, error: null }
  } catch (err) {
    return { data: null, error: { status: 0, message: (err as Error).message } }
  }
}
