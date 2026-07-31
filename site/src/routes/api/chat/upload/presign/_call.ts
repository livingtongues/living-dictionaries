import type { ChatUploadPresignRequestBody, ChatUploadPresignResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_chat_upload_presign(body: ChatUploadPresignRequestBody) {
  return await post_request<ChatUploadPresignRequestBody, ChatUploadPresignResponseBody>('/api/chat/upload/presign', body)
}
