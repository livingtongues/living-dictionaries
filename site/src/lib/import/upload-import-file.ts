import type { Readable } from 'svelte/store'
import type { SourceFileRow } from '$lib/db/server/source-files'
import { log_event } from '$lib/debug/remote-log'
import { writable } from 'svelte/store'
import { api_dict_file_confirm, api_dict_files_register } from '$api/v1/dictionaries/[id]/files/_call'
import { IMPORT_UPLOAD_FAILED } from './constants'

type ImportUploadStage = 'register' | 'upload' | 'confirm'
type ImportUploadFailureKind = 'api_error' | 'http_status' | 'network' | 'unknown'

export interface ImportUploadHandle {
  /** 0-100 — capped at 99 until the server confirms the bytes landed. */
  progress: Readable<number>
  /** Resolves with the confirmed `source_files` row; rejects on any failure. */
  done: Promise<SourceFileRow>
  abort: () => void
}

/** Register the file (`POST …/files`) → XHR PUT to the presigned url → `POST …/confirm`. */
export function upload_import_file({ file, dictionary_id }: { file: File, dictionary_id: string }): ImportUploadHandle {
  const { set, subscribe } = writable(0)
  let xhr: XMLHttpRequest | null = null
  let aborted = false
  let stage: ImportUploadStage = 'register'
  let failure_kind: ImportUploadFailureKind = 'unknown'
  let status: number | null = null
  let file_id: string | null = null
  let upload_origin: string | null = null

  async function run(): Promise<SourceFileRow> {
    const { data: registered, error } = await api_dict_files_register({
      dictionary_id,
      filename: file.name,
      mimetype: file.type || 'application/octet-stream',
      size_bytes: file.size,
    })
    if (error || !registered) {
      failure_kind = 'api_error'
      status = error?.status ?? null
      throw new Error(error?.message ?? 'Upload failed.')
    }
    file_id = registered.file.id
    try {
      const base_url = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
      upload_origin = new URL(registered.upload_url, base_url).origin
    } catch {
      upload_origin = null
    }
    if (aborted)
      throw new Error('Upload aborted.')

    stage = 'upload'
    xhr = new XMLHttpRequest()
    await new Promise<void>((resolve, reject) => {
      const request = xhr as XMLHttpRequest
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable)
          set(Math.min(Math.round((event.loaded / event.total) * 100), 99))
      })
      request.addEventListener('load', () => {
        const { status: request_status } = request
        if (request_status >= 200 && request_status < 300)
          resolve()
        else {
          failure_kind = 'http_status'
          status = request_status
          reject(new Error(`Failed to upload file (status ${request_status}).`))
        }
      })
      request.addEventListener('error', () => {
        const { status: request_status } = request
        failure_kind = 'network'
        status = request_status
        reject(new Error('Failed to upload file.'))
      })
      request.addEventListener('abort', () => reject(new Error('Upload aborted.')))
      request.open('PUT', registered.upload_url)
      request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      request.send(file)
    })

    stage = 'confirm'
    const { data: confirmed, error: confirm_error } = await api_dict_file_confirm({ dictionary_id, file_id: registered.file.id })
    if (confirm_error || !confirmed) {
      failure_kind = 'api_error'
      status = confirm_error?.status ?? null
      throw new Error(confirm_error?.message ?? 'Upload could not be confirmed.')
    }
    set(100)
    return confirmed.file
  }

  const done = run()
  done.catch((err: unknown) => {
    if (aborted)
      return
    const error = err instanceof Error ? err : new Error(String(err))
    log_event({
      level: 'error',
      message: IMPORT_UPLOAD_FAILED,
      stack: error.stack,
      context: {
        dictionary_id,
        file_id,
        filename: file.name,
        mimetype: file.type || 'application/octet-stream',
        size_bytes: file.size,
        stage,
        failure_kind,
        status,
        upload_origin,
        error_message: error.message,
      },
    })
  })

  return {
    progress: { subscribe },
    done,
    abort: () => {
      aborted = true
      xhr?.abort()
    },
  }
}
