import { redirect } from '@sveltejs/kit'

/** Team chat moved from /admin/team to the two-door /chat + /admin/chat. */
export function load({ url }: { url: URL }) {
  redirect(301, `/admin/chat${url.search}`)
}
