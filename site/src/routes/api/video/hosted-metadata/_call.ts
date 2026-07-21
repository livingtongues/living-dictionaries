import type { HostedMetadataRequestBody, HostedMetadataResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_video_hosted_metadata(body: HostedMetadataRequestBody) {
  return await post_request<HostedMetadataRequestBody, HostedMetadataResponseBody>('/api/video/hosted-metadata', body)
}
