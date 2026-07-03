import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'
import { ResponseCodes } from '$lib/constants'

// Old-app view URLs (`/entries/list` etc.) — these are view modes of the
// entries page now, not entry ids.
const LEGACY_VIEW_NAMES = new Set(['list', 'gallery', 'print', 'table'])

export const load: PageLoad = ({ params }) => {
  const dictionary_segment = encodeURIComponent(params.dictionaryId)
  if (LEGACY_VIEW_NAMES.has(params.redirectId))
    redirect(ResponseCodes.MOVED_PERMANENTLY_PRESERVE_REQUEST, `/${dictionary_segment}/entries`)
  redirect(ResponseCodes.MOVED_PERMANENTLY_PRESERVE_REQUEST, `/${dictionary_segment}/entry/${encodeURIComponent(params.redirectId)}`)
}
