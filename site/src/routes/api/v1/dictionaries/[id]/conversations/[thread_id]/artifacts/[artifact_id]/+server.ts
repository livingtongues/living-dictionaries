import type { RequestHandler } from './$types'
import { dev } from '$app/environment'
import { ResponseCodes } from '$lib/constants'
import { get_artifact } from '$lib/db/server/import-conversations'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { require_conversation } from '$lib/import/server/conversation-access'
import { get_attachment_stream, R2AttachmentNotFound } from '$lib/r2/get-attachment'
import { r2_is_configured } from '$lib/r2/import-files'
import { read_dev_media } from '$lib/server/dev-media-dir'
import { error } from '@sveltejs/kit'

/**
 * GET the artifact bytes. Served from our own origin so the conversation page
 * can render it in a sandboxed iframe; `?download` swaps the disposition for the
 * "Download" button. Same manager-or-team gate as the rest of the conversation.
 */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'write' })
  const db = get_shared_db()
  const conversation = require_conversation({ db, dictionary_id: dictionary.id, thread_id: event.params.thread_id })

  const artifact = event.params.artifact_id ? get_artifact({ db, artifact_id: event.params.artifact_id }) : null
  if (!artifact || artifact.thread_id !== conversation.id)
    error(ResponseCodes.NOT_FOUND, 'artifact not found')

  const filename = `${(artifact.title || artifact.kind).replace(/[^\w -]+/g, '')}.html`
  const disposition = event.url.searchParams.has('download')
    ? `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    : 'inline'
  const headers = {
    'Content-Type': artifact.mimetype,
    'Content-Disposition': disposition,
    // The report links to live entries and is only meaningful to the people in
    // this conversation — never let a shared cache hold it.
    'Cache-Control': 'private, max-age=0, no-store',
    'X-Content-Type-Options': 'nosniff',
    // Artifacts are authored by whoever ran the import (our agents today,
    // outside agents tomorrow) and are served from our OWN origin, so they must
    // never execute script — not in the conversation page's iframe and not when
    // opened directly in a tab. `default-src 'none'` with no `script-src`
    // granted blocks inline AND external script outright, which is what makes
    // the iframe's `allow-same-origin` (needed for height measurement) safe.
    // Reports are therefore written to work without JS: `<details>` sections and
    // plain anchor links. Deliberately NOT using the CSP `sandbox` directive —
    // it would intersect with the iframe sandbox and drop same-origin, costing
    // height measurement without adding protection script-src already gives.
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
  }

  if (!r2_is_configured() && dev) {
    const bytes = read_dev_media({ key: artifact.storage_key })
    if (!bytes)
      error(ResponseCodes.NOT_FOUND, 'Artifact bytes missing from storage')
    return new Response(new Uint8Array(bytes), { status: 200, headers })
  }

  try {
    const stream = await get_attachment_stream({ key: artifact.storage_key })
    return new Response(stream.body, {
      status: 200,
      headers: { ...headers, ...(stream.content_length ? { 'Content-Length': String(stream.content_length) } : {}) },
    })
  } catch (err) {
    if (err instanceof R2AttachmentNotFound)
      error(ResponseCodes.NOT_FOUND, 'Artifact bytes missing from storage')
    throw err
  }
}
