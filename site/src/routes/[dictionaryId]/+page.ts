import { redirect } from '@sveltejs/kit'

import type { PageLoad } from './$types'
import { ResponseCodes } from '$lib/constants'

export const load: PageLoad = ({ params }) => {
  // encodeURIComponent — legacy dict ids contain characters that cannot go
  // into a Location header (the layout 301s to the canonical url first, but
  // this load must not crash if reached directly).
  redirect(ResponseCodes.TEMPORARY_REDIRECT, `/${encodeURIComponent(params.dictionaryId)}/entries`)
}
