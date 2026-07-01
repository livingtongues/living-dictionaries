import type { MediaCellKey, MediaFieldInput } from '$lib/db/server/v1-media-write'
import type { HostedVideo } from '$lib/types'
import type { RequestHandler } from '@sveltejs/kit'
import type { MediaCategory } from './validate-media-bytes'
import { parse_hosted_video_url } from '$lib/components/video/parse-hosted-video-url'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { attach_media, delete_media, MEDIA_CELLS, read_media_record } from '$lib/db/server/v1-media-write'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { MediaStorageNotConfiguredError, resolve_photo_serving_url, store_media_bytes } from '$lib/server/media-storage'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'
import { parse_media_request } from './media-request'
import { validate_media_bytes } from './validate-media-bytes'

/**
 * Factories that turn a {@link MediaCellKey} into the POST (attach) and DELETE
 * handlers for a v1 media route — one implementation shared across all eight
 * owner→medium cells. Each `+server.ts` is a two-liner exporting the result.
 */

function str(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function truthy(value: unknown): boolean {
  return value === true || value === 'true'
}

/** Owner label for error messages (e.g. `audio:entry` → `entry`). */
function owner_label(cell_key: MediaCellKey): string {
  return cell_key.split(':')[1]
}

/** Map a storage medium to the top-level content category the bytes must be. */
function medium_category(medium: 'audio' | 'photo' | 'video'): MediaCategory {
  return medium === 'photo' ? 'image' : medium
}

/** Reject uploaded bytes (multipart file OR fetched url) that aren't real media of this medium. */
function assert_media_bytes({ medium, bytes, declared_type }: { medium: 'audio' | 'photo' | 'video', bytes: Uint8Array, declared_type: string | null }): void {
  const check = validate_media_bytes({ category: medium_category(medium), declared_type, bytes })
  if (!check.ok)
    error(ResponseCodes.UNSUPPORTED_MEDIA_TYPE, check.reason ?? 'Unsupported media type')
}

function validate_hosted(value: unknown): HostedVideo {
  const obj = value as Record<string, unknown>
  if (!obj || (obj.type !== 'youtube' && obj.type !== 'vimeo') || typeof obj.video_id !== 'string' || !obj.video_id)
    error(ResponseCodes.BAD_REQUEST, 'hosted_elsewhere must be { type: "youtube"|"vimeo", video_id, start_at_seconds? }')
  const hosted: HostedVideo = { type: obj.type as 'youtube' | 'vimeo', video_id: obj.video_id }
  if (obj.start_at_seconds !== undefined && obj.start_at_seconds !== null)
    hosted.start_at_seconds = Number(obj.start_at_seconds)
  return hosted
}

/** Resolve a video's `hosted_elsewhere` from a structured object OR a raw `hosted_url`. */
function resolve_hosted(fields: Record<string, unknown>): HostedVideo | undefined {
  if (fields.hosted_elsewhere !== undefined && fields.hosted_elsewhere !== null) {
    const raw = fields.hosted_elsewhere
    if (typeof raw === 'string') {
      try {
        return validate_hosted(JSON.parse(raw))
      } catch {
        const parsed = parse_hosted_video_url(raw)
        if (!parsed)
          error(ResponseCodes.BAD_REQUEST, `Could not parse hosted_elsewhere: ${raw}`)
        return parsed
      }
    }
    return validate_hosted(raw)
  }
  const hosted_url = str(fields.hosted_url)
  if (hosted_url) {
    const parsed = parse_hosted_video_url(hosted_url)
    if (!parsed)
      error(ResponseCodes.BAD_REQUEST, `Could not parse hosted video url: ${hosted_url}`)
    return parsed
  }
  return undefined
}

async function store_bytes({ folder, file_name, file_type, bytes }: { folder: string, file_name: string, file_type: string, bytes: Uint8Array }) {
  try {
    return await store_media_bytes({ folder, file_name, file_type, bytes })
  } catch (err) {
    if (err instanceof MediaStorageNotConfiguredError)
      error(ResponseCodes.SERVICE_UNAVAILABLE, err.message)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Upload failed: ${(err as Error).message}`)
  }
}

export function make_media_attach_handler(cell_key: MediaCellKey): RequestHandler {
  const cell = MEDIA_CELLS[cell_key]
  return async (event) => {
    const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
    const owner_id = event.params[cell.owner_param]
    if (!owner_id)
      error(ResponseCodes.BAD_REQUEST, `Missing ${cell.owner_param}`)

    const db = get_dictionary_db(dictionary.id)

    // Pre-checks BEFORE uploading bytes, so a bad owner / no-op re-POST / bad
    // speaker never leaves orphaned bytes in the bucket.
    if (!db.prepare(`SELECT 1 FROM "${cell.owner_table}" WHERE id = ?`).get(owner_id))
      error(ResponseCodes.NOT_FOUND, `${owner_label(cell_key)} not found`)

    const parsed = await parse_media_request(event)
    const { fields } = parsed
    const media_id = str(fields.id)
    const replace = truthy(fields.replace)
    const speaker_id = str(fields.speaker_id)

    if (media_id && db.prepare(`SELECT 1 FROM "${cell.media_table}" WHERE id = ?`).get(media_id)) {
      const media = read_media_record({ db, cell_key, media_id })
      return json({ [cell.medium]: media, created: false })
    }
    if (speaker_id) {
      if (!cell.speaker)
        error(ResponseCodes.BAD_REQUEST, `${cell.medium} media does not support a speaker`)
      if (!db.prepare(`SELECT 1 FROM speakers WHERE id = ?`).get(speaker_id))
        error(ResponseCodes.BAD_REQUEST, 'speaker not found')
    }

    const media_fields: MediaFieldInput = { source: str(fields.source) ?? null }

    if (cell.medium === 'video') {
      const hosted = resolve_hosted(fields)
      if (hosted) {
        media_fields.hosted_elsewhere = hosted
      } else if (parsed.bytes) {
        assert_media_bytes({ medium: cell.medium, bytes: parsed.bytes, declared_type: parsed.file_type })
        const stored = await store_bytes({ folder: `${dictionary.id}/${cell.folder}/${owner_id}`, file_name: parsed.file_name ?? 'upload', file_type: parsed.file_type ?? 'application/octet-stream', bytes: parsed.bytes })
        media_fields.storage_path = stored.storage_path
      } else {
        error(ResponseCodes.BAD_REQUEST, 'Provide a video file, a url, or a hosted_elsewhere/hosted_url link')
      }
      media_fields.videographer = str(fields.videographer) ?? null
    } else {
      if (!parsed.bytes)
        error(ResponseCodes.BAD_REQUEST, 'Provide a file (multipart) or a url')
      assert_media_bytes({ medium: cell.medium, bytes: parsed.bytes, declared_type: parsed.file_type })
      const stored = await store_bytes({ folder: `${dictionary.id}/${cell.folder}/${owner_id}`, file_name: parsed.file_name ?? 'upload', file_type: parsed.file_type ?? 'application/octet-stream', bytes: parsed.bytes })
      media_fields.storage_path = stored.storage_path
      if (cell.medium === 'photo') {
        media_fields.photographer = str(fields.photographer) ?? null
        try {
          media_fields.serving_url = await resolve_photo_serving_url({ bucket: stored.bucket, object_key: stored.storage_path, dev_mock: stored.dev_mock })
        } catch (err) {
          if (err instanceof MediaStorageNotConfiguredError)
            error(ResponseCodes.SERVICE_UNAVAILABLE, err.message)
          error(ResponseCodes.INTERNAL_SERVER_ERROR, `Serving-url generation failed: ${(err as Error).message}`)
        }
      }
    }

    let result
    try {
      result = attach_media({ db, history_db: get_dictionary_history_db(dictionary.id), cell_key, owner_id, media_id, fields: media_fields, speaker_id, replace, user_id: access.user_id, api_key_id: access.key_id ?? null })
    } catch (err) {
      error(ResponseCodes.BAD_REQUEST, (err as Error).message)
    }
    if (!result.found)
      error(ResponseCodes.NOT_FOUND, `${owner_label(cell_key)} not found`)

    mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
    log_server_event({ level: 'info', message: 'v1_media_attached', user_id: access.user_id, context: { dictionary_id: dictionary.id, cell: cell_key, owner_id, media_id: result.media?.id, replace, via: access.via } })

    return json({ [cell.medium]: result.media, created: result.created })
  }
}

export function make_media_delete_handler(cell_key: MediaCellKey): RequestHandler {
  const cell = MEDIA_CELLS[cell_key]
  return async (event) => {
    const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
    const owner_id = event.params[cell.owner_param]
    const media_id = event.params[cell.media_param]
    if (!owner_id || !media_id)
      error(ResponseCodes.BAD_REQUEST, 'Missing owner or media id')

    const result = delete_media({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), cell_key, owner_id, media_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
    if (!result.found)
      error(ResponseCodes.NOT_FOUND, `${cell.medium} not linked to this ${owner_label(cell_key)}`)

    mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
    log_server_event({ level: 'info', message: 'v1_media_deleted', user_id: access.user_id, context: { dictionary_id: dictionary.id, cell: cell_key, owner_id, media_id, via: access.via } })

    return json({ result: 'deleted' })
  }
}
