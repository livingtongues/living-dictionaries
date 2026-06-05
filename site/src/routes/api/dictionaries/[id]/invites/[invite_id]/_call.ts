import type { DictionariesIdInvitesInviteIdDeleteResponseBody } from './+server'
import { ResponseCodes } from '$lib/constants'

export async function api_dictionaries_id_invite_cancel({ dict_id, invite_id }: { dict_id: string, invite_id: string }) {
  try {
    const response = await fetch(`/api/dictionaries/${dict_id}/invites/${invite_id}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
    })
    if (response.status !== ResponseCodes.OK) {
      const message = await response.text()
      return { data: null, error: { status: response.status, message } }
    }
    const data = await response.json() as DictionariesIdInvitesInviteIdDeleteResponseBody
    return { data, error: null }
  } catch (err) {
    return { data: null, error: { status: 0, message: (err as Error).message } }
  }
}
