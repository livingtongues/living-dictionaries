import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

/**
 * Public contact-form endpoint. The browser cannot call the internal
 * `/api/messages/contact` endpoint directly because that one is guarded by the
 * shared `x-internal-secret` header. This thin same-origin proxy injects the
 * secret server-side (so it never reaches client code) and forwards the
 * payload, keeping the internal endpoint's threading/DB logic as the single
 * source of truth.
 */

export interface ContactRequestBody {
  name: string
  email: string
  message: string
  url: string
  subject?: string
  subject_key?: string
  dictionary_id?: string
  dictionary_name?: string
}

export interface ContactResponseBody {
  ok: true
  thread_id: string
}

export const POST: RequestHandler = async ({ request, fetch }) => {
  const internal_secret = env.INTERNAL_INGEST_SECRET
  if (!internal_secret)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, 'INTERNAL_INGEST_SECRET not configured')

  const body = await request.json() as ContactRequestBody

  const response = await fetch('/api/messages/contact', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': internal_secret,
    },
    body: JSON.stringify(body),
  })

  if (response.status !== ResponseCodes.OK) {
    const message = await response.text()
    error(response.status, message || 'Contact submission failed')
  }

  return json(await response.json() as ContactResponseBody)
}
