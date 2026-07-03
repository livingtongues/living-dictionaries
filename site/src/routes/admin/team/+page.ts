import { redirect } from '@sveltejs/kit'

/** Team chat moved out of /admin to the standalone membership-based /chat. */
export function load({ url }: { url: URL }) {
  redirect(301, `/chat${url.search}`)
}
