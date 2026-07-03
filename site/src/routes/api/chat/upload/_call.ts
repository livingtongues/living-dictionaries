import type { ChatUploadResponse } from './+server'

interface CallReturn {
  data: ChatUploadResponse | null
  error: { status: number, message: string } | null
}

/**
 * Multipart upload — can't use the JSON `post_request` helper. Sends the raw
 * `File`s as `multipart/form-data` (the browser sets the boundary header) for
 * an already-posted chat message; relies on the same-origin session cookie for
 * auth like the message-attachment upload.
 */
export async function api_chat_upload({ message_id, files }: { message_id: string, files: File[] }): Promise<CallReturn> {
  try {
    const form_data = new FormData()
    form_data.append('message_id', message_id)
    for (const file of files)
      form_data.append('files', file)
    const response = await fetch('/api/chat/upload', { method: 'POST', body: form_data })
    if (!response.ok) {
      let message = `Upload failed (${response.status})`
      try {
        const { message: body_message } = await response.json() as { message?: string }
        if (body_message)
          message = body_message
      } catch { /* non-JSON error body */ }
      return { data: null, error: { status: response.status, message } }
    }
    return { data: await response.json() as ChatUploadResponse, error: null }
  } catch (err) {
    return { data: null, error: { status: 0, message: `Network error: ${(err as Error).message}` } }
  }
}
