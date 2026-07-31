import type { ChatUploadCommitRequestBody, ChatUploadCommitResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

/** Re-exported so client code can type an upload batch without importing `+server`. */
export type { ChatUploadCommitFile } from './+server'

export async function api_chat_upload_commit(body: ChatUploadCommitRequestBody) {
  return await post_request<ChatUploadCommitRequestBody, ChatUploadCommitResponseBody>('/api/chat/upload/commit', body)
}
