import type { VideoGenerateThumbnailRequestBody, VideoGenerateThumbnailResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_video_generate_thumbnail(body: VideoGenerateThumbnailRequestBody) {
  return await post_request<VideoGenerateThumbnailRequestBody, VideoGenerateThumbnailResponseBody>('/api/video/generate-thumbnail', body)
}
