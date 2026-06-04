import { invalidateAll } from '$app/navigation'
import { get_auth_user } from './user.svelte'

/** Clear the server session cookie + reactive user state, then re-run loads. */
export async function sign_out() {
  await get_auth_user().logout()
  await invalidateAll()
}
