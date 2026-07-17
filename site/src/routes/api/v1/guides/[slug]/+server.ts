import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { get_guide } from '$lib/api/v1/guides'
import { error } from '@sveltejs/kit'

/** GET /api/v1/guides/[slug] — one guide as raw markdown. */
export const GET: RequestHandler = ({ params }) => {
  const guide = get_guide(params.slug ?? '')
  if (!guide)
    error(ResponseCodes.NOT_FOUND, 'guide not found')
  return new Response(guide, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
