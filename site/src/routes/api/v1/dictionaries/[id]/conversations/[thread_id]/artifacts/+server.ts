import type { RequestHandler } from './$types'
import type { ThreadArtifactRow } from '$lib/db/server/import-conversations'
import { dev } from '$app/environment'
import { ResponseCodes } from '$lib/constants'
import { create_artifact, list_artifacts } from '$lib/db/server/import-conversations'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { require_conversation, require_team } from '$lib/import/server/conversation-access'
import { put_import_object, r2_is_configured } from '$lib/r2/import-files'
import { write_dev_media } from '$lib/server/dev-media-dir'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

/** 5MB — a report embeds sample entries, never media. */
const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024

export interface V1ConversationArtifactsPostRequestBody {
  /** 'report' after a write, 'preview' before one. */
  kind: 'preview' | 'report'
  /** Shown as the block heading, e.g. "Import report". */
  title?: string
  /** The whole self-contained HTML document. */
  html: string
  /** The v1 write batch this reports on, so the record ties back to the data. */
  import_id?: string | null
  source_id?: string | null
  /** Free-form counts rendered as the block's summary line, e.g. `{ entries: 1827 }`. */
  stats?: Record<string, unknown> | null
}

export interface V1ConversationArtifactsPostResponseBody {
  artifact: ThreadArtifactRow
}

export interface V1ConversationArtifactsGetResponseBody {
  artifacts: ThreadArtifactRow[]
}

export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'write' })
  const db = get_shared_db()
  const conversation = require_conversation({ db, dictionary_id: dictionary.id, thread_id: event.params.thread_id })
  return json({ artifacts: list_artifacts({ db, thread_id: conversation.id }) } satisfies V1ConversationArtifactsGetResponseBody)
}

/**
 * POST a generated HTML artifact (guide §2.8). Stored verbatim and never
 * regenerated in place — a report is a frozen snapshot of what we said at the
 * time, which is the only version worth keeping.
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const db = get_shared_db()
  const conversation = require_conversation({ db, dictionary_id: dictionary.id, thread_id: event.params.thread_id })
  require_team({ db, access })

  const body = await event.request.json() as Partial<V1ConversationArtifactsPostRequestBody>
  if (body.kind !== 'preview' && body.kind !== 'report')
    error(ResponseCodes.BAD_REQUEST, 'kind must be "preview" or "report"')
  const { html } = body
  if (!html?.trim())
    error(ResponseCodes.BAD_REQUEST, 'html is required')
  const size_bytes = Buffer.byteLength(html, 'utf8')
  if (size_bytes > MAX_ARTIFACT_BYTES)
    error(ResponseCodes.BAD_REQUEST, `Artifact is ${size_bytes} bytes; the limit is ${MAX_ARTIFACT_BYTES}`)

  if (!r2_is_configured() && !dev)
    error(ResponseCodes.SERVICE_UNAVAILABLE, 'File storage is not configured')

  const artifact = create_artifact({
    db,
    thread_id: conversation.id,
    dictionary_id: dictionary.id,
    kind: body.kind,
    title: body.title?.trim() || (body.kind === 'report' ? 'Import report' : 'Import preview'),
    mimetype: 'text/html; charset=utf-8',
    size_bytes,
    import_id: body.import_id ?? null,
    source_id: body.source_id ?? null,
    stats_json: body.stats ? JSON.stringify(body.stats) : null,
    created_by_user_id: access.user_id,
  })

  try {
    if (r2_is_configured())
      await put_import_object({ key: artifact.storage_key, content: html, mimetype: 'text/html; charset=utf-8' })
    else
      write_dev_media({ key: artifact.storage_key, content: html })
  } catch (err) {
    db.prepare('DELETE FROM thread_artifacts WHERE id = ?').run(artifact.id)
    log_server_event({ level: 'error', message: 'import_artifact_upload_failed', error: err, context: { dictionary_id: dictionary.id, thread_id: conversation.id, artifact_id: artifact.id } })
    throw err
  }

  log_server_event({ level: 'info', message: 'import_artifact_created', user_id: access.user_id, context: { dictionary_id: dictionary.id, thread_id: conversation.id, artifact_id: artifact.id, kind: artifact.kind, size_bytes, via: access.via } })
  return json({ artifact } satisfies V1ConversationArtifactsPostResponseBody)
}
