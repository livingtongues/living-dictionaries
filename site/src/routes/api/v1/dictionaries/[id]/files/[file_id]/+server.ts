import type { RequestHandler } from './$types'
import type { SourceFileRow, SourceFileUpdatableField } from '$lib/db/server/source-files'
import { dev } from '$app/environment'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { delete_source_file, get_source_file, update_source_file } from '$lib/db/server/source-files'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { get_attachment_stream, R2AttachmentNotFound } from '$lib/r2/get-attachment'
import { delete_import_object, r2_is_configured } from '$lib/r2/import-files'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json, redirect } from '@sveltejs/kit'

export interface V1FilePatchRequestBody {
  filename?: string
  import_instructions?: string | null
  source_note?: string | null
  /** An existing dict-db `sources.id` — links this file to its permanent source. Null unlinks. */
  source_id?: string | null
}

export interface V1FilePatchResponseBody {
  file: SourceFileRow
}

function require_file({ dictionary_id, file_id }: { dictionary_id: string, file_id: string | undefined }): SourceFileRow {
  const file = file_id ? get_source_file({ db: get_shared_db(), dictionary_id, file_id }) : null
  if (!file)
    error(ResponseCodes.NOT_FOUND, 'file not found')
  return file
}

/** GET /api/v1/dictionaries/[id]/files/[file_id] — download the original resource bytes. */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'write' })
  const file = require_file({ dictionary_id: dictionary.id, file_id: event.params.file_id })

  if (!r2_is_configured() && dev)
    redirect(ResponseCodes.TEMPORARY_REDIRECT, `/api/dev-media/${file.storage_key}`)

  let stream: { body: ReadableStream<Uint8Array>, content_length: number }
  try {
    stream = await get_attachment_stream({ key: file.storage_key })
  } catch (err) {
    if (err instanceof R2AttachmentNotFound)
      error(ResponseCodes.NOT_FOUND, 'File bytes missing from storage')
    throw err
  }

  return new Response(stream.body, {
    status: 200,
    headers: {
      'Content-Type': file.mimetype || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      ...(stream.content_length ? { 'Content-Length': String(stream.content_length) } : {}),
    },
  })
}

/** PATCH /api/v1/dictionaries/[id]/files/[file_id] — update instructions / source note / source link / filename. */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  require_file({ dictionary_id: dictionary.id, file_id: event.params.file_id })

  const body = await event.request.json() as V1FilePatchRequestBody
  const fields: Partial<Record<SourceFileUpdatableField, string | null>> = {}
  if ('filename' in body) {
    if (!body.filename?.trim())
      error(ResponseCodes.BAD_REQUEST, 'filename cannot be empty')
    fields.filename = body.filename.trim()
  }
  if ('import_instructions' in body)
    fields.import_instructions = body.import_instructions?.trim() || null
  if ('source_note' in body)
    fields.source_note = body.source_note?.trim() || null
  if ('source_id' in body) {
    if (body.source_id) {
      const source = get_dictionary_db(dictionary.id)
        .prepare('SELECT id FROM sources WHERE id = ?')
        .get(body.source_id)
      if (!source)
        error(ResponseCodes.BAD_REQUEST, `source_id ${body.source_id} does not exist in this dictionary's source registry — create the source first (POST …/sources)`)
    }
    fields.source_id = body.source_id ?? null
  }
  if (!Object.keys(fields).length)
    error(ResponseCodes.BAD_REQUEST, 'No updatable fields provided')

  const file = update_source_file({ db: get_shared_db(), dictionary_id: dictionary.id, file_id: event.params.file_id, fields })
  log_server_event({ level: 'info', message: 'import_file_updated', user_id: access.user_id, context: { dictionary_id: dictionary.id, file_id: event.params.file_id, fields: Object.keys(fields), via: access.via } })
  return json({ file } satisfies V1FilePatchResponseBody)
}

/** DELETE /api/v1/dictionaries/[id]/files/[file_id] — remove the resource (row + bytes). Blocked once an import was requested, except for site admins. */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const file = require_file({ dictionary_id: dictionary.id, file_id: event.params.file_id })

  if (file.import_requested_at && access.role !== 'admin')
    error(ResponseCodes.FORBIDDEN, 'This file is part of a requested import — ask us to remove it')

  const deleted = delete_source_file({ db: get_shared_db(), dictionary_id: dictionary.id, file_id: file.id })
  if (deleted && r2_is_configured()) {
    try {
      await delete_import_object({ key: deleted.storage_key })
    } catch (err) {
      log_server_event({ level: 'warn', message: 'import_file_r2_delete_failed', error: err, context: { dictionary_id: dictionary.id, file_id: file.id, storage_key: deleted.storage_key } })
    }
  }
  log_server_event({ level: 'info', message: 'import_file_deleted', user_id: access.user_id, context: { dictionary_id: dictionary.id, file_id: file.id, via: access.via } })
  return json({ result: 'deleted' })
}
