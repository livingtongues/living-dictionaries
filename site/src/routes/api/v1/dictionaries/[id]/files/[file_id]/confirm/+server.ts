import type { RequestHandler } from './$types'
import type { SourceFileRow } from '$lib/db/server/source-files'
import { dev } from '$app/environment'
import { ResponseCodes } from '$lib/constants'
import { confirm_source_file, delete_source_file, get_source_file, MAX_IMPORT_FILE_BYTES } from '$lib/db/server/source-files'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { delete_import_object, head_import_object, r2_is_configured } from '$lib/r2/import-files'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1FileConfirmResponseBody {
  file: SourceFileRow
}

/**
 * POST /api/v1/dictionaries/[id]/files/[file_id]/confirm — after PUTting the
 * bytes to the presigned url, confirm the upload landed. The server verifies
 * the object really exists in R2 (and enforces the size cap on what was
 * actually stored — the presigned PUT itself can't).
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const db = get_shared_db()
  const file = event.params.file_id ? get_source_file({ db, dictionary_id: dictionary.id, file_id: event.params.file_id }) : null
  if (!file)
    error(ResponseCodes.NOT_FOUND, 'file not found')

  if (!r2_is_configured() && dev) {
    const confirmed = confirm_source_file({ db, dictionary_id: dictionary.id, file_id: file.id })
    return json({ file: confirmed } satisfies V1FileConfirmResponseBody)
  }

  const stored_bytes = await head_import_object({ key: file.storage_key })
  if (stored_bytes === null)
    error(ResponseCodes.BAD_REQUEST, 'No uploaded bytes found — PUT the file to the upload_url first')
  if (stored_bytes > MAX_IMPORT_FILE_BYTES) {
    await delete_import_object({ key: file.storage_key })
    delete_source_file({ db, dictionary_id: dictionary.id, file_id: file.id })
    log_server_event({ level: 'warn', message: 'import_file_oversize_rejected', user_id: access.user_id, context: { dictionary_id: dictionary.id, file_id: file.id, stored_bytes } })
    error(ResponseCodes.BAD_REQUEST, `Uploaded file exceeds the ${Math.round(MAX_IMPORT_FILE_BYTES / 1024 / 1024)}MB limit and was removed`)
  }

  const confirmed = confirm_source_file({ db, dictionary_id: dictionary.id, file_id: file.id, size_bytes: stored_bytes })
  log_server_event({ level: 'info', message: 'import_file_confirmed', user_id: access.user_id, context: { dictionary_id: dictionary.id, file_id: file.id, stored_bytes, via: access.via } })
  return json({ file: confirmed } satisfies V1FileConfirmResponseBody)
}
