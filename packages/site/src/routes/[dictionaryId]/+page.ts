import type { PageLoad } from './$types'

import { ResponseCodes } from '$lib/constants'
import { redirect } from '@sveltejs/kit'

export const load: PageLoad = ({ params }) => {
  redirect(ResponseCodes.TEMPORARY_REDIRECT, `/${params.dictionaryId}/entries`)
}
