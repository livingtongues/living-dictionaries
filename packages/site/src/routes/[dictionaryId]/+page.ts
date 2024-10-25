import { redirect } from '@sveltejs/kit'

import type { PageLoad } from './$types'
import { ResponseCodes } from '$lib/constants'

export const load: PageLoad = ({ params }) => {
  redirect(ResponseCodes.TEMPORARY_REDIRECT, `/${params.dictionaryId}/entries`)
}
