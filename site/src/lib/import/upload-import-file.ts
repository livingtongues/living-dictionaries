import type { Readable } from 'svelte/store'
import type { SourceFileRow } from '$lib/db/server/source-files'
import { writable } from 'svelte/store'
import { api_dict_file_confirm, api_dict_files_register } from '$api/v1/dictionaries/[id]/files/_call'

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

  async function run(): Promise<SourceFileRow> {
    const { data: registered, error } = await api_dict_files_register({
      dictionary_id,
      filename: file.name,
      mimetype: file.type || 'application/octet-stream',
      size_bytes: file.size,
    })
    if (error || !registered)
      throw new Error(error?.message ?? 'Upload failed.')
    if (aborted)
      throw new Error('Upload aborted.')

    xhr = new XMLHttpRequest()
    await new Promise<void>((resolve, reject) => {
      const request = xhr as XMLHttpRequest
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable)
          set(Math.min(Math.round((event.loaded / event.total) * 100), 99))
      })
      request.addEventListener('load', () => {
        if (request.status >= 200 && request.status < 300)
          resolve()
        else
          reject(new Error(`Failed to upload file (status ${request.status}).`))
      })
      request.addEventListener('error', () => reject(new Error('Failed to upload file.')))
      request.addEventListener('abort', () => reject(new Error('Upload aborted.')))
      request.open('PUT', registered.upload_url)
      request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      request.send(file)
    })

    const { data: confirmed, error: confirm_error } = await api_dict_file_confirm({ dictionary_id, file_id: registered.file.id })
    if (confirm_error || !confirmed)
      throw new Error(confirm_error?.message ?? 'Upload could not be confirmed.')
    set(100)
    return confirmed.file
  }

  const done = run()
  done.catch((err: unknown) => console.error(err))

  return {
    progress: { subscribe },
    done,
    abort: () => {
      aborted = true
      xhr?.abort()
    },
  }
}
