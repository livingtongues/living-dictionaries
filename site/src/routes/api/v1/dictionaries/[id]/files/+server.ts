import type { RequestHandler } from './$types'
import type { ImportFileForClient, ImportRequestSummary } from '$lib/import/types'
import { dev } from '$app/environment'
import { ResponseCodes } from '$lib/constants'
import { create_pending_source_file, list_source_files, MAX_IMPORT_FILE_BYTES } from '$lib/db/server/source-files'
import type { SourceFileRow } from '$lib/db/server/source-files'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { can_manage_requested_file, list_import_requests } from '$lib/import/server/import-request-thread'
import { presign_import_upload, r2_is_configured } from '$lib/r2/import-files'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

/**
 * Import-resource files for a dictionary (`source_files`, server-only
 * shared.db). Managers (session) and write-scoped agent keys only — file
 * names + import instructions are never public.
 */

export interface V1FilesGetResponseBody {
  files: ImportFileForClient[]
  requests: ImportRequestSummary[]
}

export interface V1FilePostRequestBody {
  filename: string
  mimetype: string
  size_bytes: number
}

export interface V1FilePostResponseBody {
  file: SourceFileRow
  /** PUT the raw bytes here (Content-Type must match `mimetype`), then POST …/files/{id}/confirm. */
  upload_url: string
  /** DEV-only: bytes land in the local dev-media store, not R2. */
  dev_mock?: boolean
}

/** GET /api/v1/dictionaries/[id]/files — list uploaded import resources. Manager/agent-write only. */
export const GET: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const db = get_shared_db()
  const files = list_source_files({ db, dictionary_id: dictionary.id }).map(file => ({
    ...file,
    can_manage_requested: !file.import_requested_at || can_manage_requested_file({ db, access, file }),
  }))
  const requests = list_import_requests({ db, dictionary_id: dictionary.id, access })
  return json({ files, requests } satisfies V1FilesGetResponseBody)
}

/** POST /api/v1/dictionaries/[id]/files — register an upload + get a presigned PUT url. */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const body = await event.request.json() as Partial<V1FilePostRequestBody>
  const filename = body.filename?.trim()
  const mimetype = body.mimetype?.trim() || 'application/octet-stream'
  const size_bytes = Number(body.size_bytes)
  if (!filename)
    error(ResponseCodes.BAD_REQUEST, 'filename is required')
  if (!Number.isFinite(size_bytes) || size_bytes <= 0)
    error(ResponseCodes.BAD_REQUEST, 'size_bytes must be a positive number')
  if (size_bytes > MAX_IMPORT_FILE_BYTES)
    error(ResponseCodes.BAD_REQUEST, `File is too large — the limit is ${Math.round(MAX_IMPORT_FILE_BYTES / 1024 / 1024)}MB. If your resource is bigger, something is probably wrong; contact us instead.`)

  const use_dev_mock = !r2_is_configured() && dev
  if (!r2_is_configured() && !use_dev_mock)
    error(ResponseCodes.SERVICE_UNAVAILABLE, 'File uploads are not configured (missing R2 credentials)')

  const file = create_pending_source_file({
    db: get_shared_db(),
    dictionary_id: dictionary.id,
    filename,
    mimetype,
    size_bytes,
    uploaded_by_user_id: access.user_id,
  })

  const upload_url = use_dev_mock
    ? `/api/dev-media/${file.storage_key}`
    : await presign_import_upload({ key: file.storage_key, mimetype })

  log_server_event({ level: 'info', message: 'import_file_registered', user_id: access.user_id, context: { dictionary_id: dictionary.id, file_id: file.id, filename, size_bytes, via: access.via } })
  return json({ file, upload_url, ...(use_dev_mock ? { dev_mock: true } : {}) } satisfies V1FilePostResponseBody)
}
