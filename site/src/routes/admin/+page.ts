import type { PageLoad } from './$types'
import { redirect } from '@sveltejs/kit'

export const load: PageLoad = () => {
  redirect(307, '/admin/messages')
}
