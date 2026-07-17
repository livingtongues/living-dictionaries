import type { RequestHandler } from './$types'
import type { GuideInfo } from '$lib/api/v1/guides'
import { list_guides } from '$lib/api/v1/guides'
import { json } from '@sveltejs/kit'

export interface V1GuidesResponseBody {
  guides: (GuideInfo & { url: string })[]
}

/** GET /api/v1/guides — public list of format-import guides. */
export const GET: RequestHandler = ({ url }) => {
  const guides = list_guides().map(guide => ({ ...guide, url: `${url.origin}/api/v1/guides/${guide.slug}` }))
  return json({ guides } satisfies V1GuidesResponseBody, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  })
}
