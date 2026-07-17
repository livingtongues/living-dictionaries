import type { RequestHandler } from './$types'
import { PUBLIC_STORAGE_BUCKET } from '$env/static/public'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { url_from_storage_path } from '$lib/utils/media-url'
import { error, redirect } from '@sveltejs/kit'

/**
 * GET /api/v1/dictionaries/[id]/media/[...path] — download the bytes of a media
 * row by its `storage_path`. Stable consumer-facing URL (the `download_url` in
 * v1 read shapes): verifies the path belongs to a media row in THIS dictionary,
 * then 302-redirects to the storage backend. Redirecting (rather than exposing
 * backend URLs in responses) keeps consumers agnostic of where bytes live and
 * keeps access behind the dictionary-scoped key.
 */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })

  const storage_path = event.params.path ?? '' // SvelteKit already decodes rest-param segments
  if (!storage_path)
    error(ResponseCodes.BAD_REQUEST, 'Missing media path')

  const db = get_dictionary_db(dictionary.id)
  const known = db.prepare(
    `SELECT 1 FROM audio WHERE storage_path = ?
     UNION SELECT 1 FROM photos WHERE storage_path = ?
     UNION SELECT 1 FROM videos WHERE storage_path = ?`,
  ).get(storage_path, storage_path, storage_path)
  if (!known)
    error(ResponseCodes.NOT_FOUND, 'media not found in this dictionary')

  redirect(ResponseCodes.FOUND, url_from_storage_path(storage_path, PUBLIC_STORAGE_BUCKET))
}
