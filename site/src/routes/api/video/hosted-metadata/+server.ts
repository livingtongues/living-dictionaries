import type { HostedMetadata, HostedVideo } from '$lib/types'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { fetch_hosted_video_metadata } from '$lib/video/hosted-video-metadata'
import { error, json } from '@sveltejs/kit'

export interface HostedMetadataRequestBody {
  hosted_video: HostedVideo
}

export interface HostedMetadataResponseBody {
  metadata: HostedMetadata | null
}

function valid_hosted_video(value: unknown): value is HostedVideo {
  if (!value || typeof value !== 'object')
    return false
  const video = value as Record<string, unknown>
  return (video.type === 'youtube' || video.type === 'vimeo')
    && typeof video.video_id === 'string'
    && Boolean(video.video_id)
    && (video.start_at_seconds === undefined || (typeof video.start_at_seconds === 'number' && Number.isFinite(video.start_at_seconds) && video.start_at_seconds >= 0))
}

export async function POST(event) {
  await verify_auth(event)
  const body = await event.request.json() as HostedMetadataRequestBody
  if (!valid_hosted_video(body.hosted_video))
    error(ResponseCodes.BAD_REQUEST, 'Invalid hosted video reference')
  const metadata = await fetch_hosted_video_metadata({ hosted_video: body.hosted_video })
  return json({ metadata: metadata ?? null } satisfies HostedMetadataResponseBody)
}
