import type { HostedMetadata, HostedVideo } from '$lib/types'

interface OEmbedResponse {
  title?: unknown
  description?: unknown
  thumbnail_url?: unknown
  duration?: unknown
}

const HOSTED_METADATA_TIMEOUT_MS = 5_000

function clean_text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function metadata_from_oembed(provider: HostedVideo['type'], response: OEmbedResponse): HostedMetadata | undefined {
  const duration = Number(response.duration)
  const metadata: HostedMetadata = {
    ...(clean_text(response.title) ? { title: clean_text(response.title) } : {}),
    ...(provider === 'vimeo' && clean_text(response.description) ? { description: clean_text(response.description) } : {}),
    ...(clean_text(response.thumbnail_url) ? { thumbnail_url: clean_text(response.thumbnail_url) } : {}),
    ...(provider === 'vimeo' && Number.isFinite(duration) && duration > 0 ? { duration_seconds: duration } : {}),
  }
  return Object.keys(metadata).length ? metadata : undefined
}

export function hosted_video_url(hosted_video: HostedVideo): string {
  return hosted_video.type === 'youtube'
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(hosted_video.video_id)}`
    : `https://vimeo.com/${encodeURIComponent(hosted_video.video_id)}`
}

export async function fetch_hosted_video_metadata({ hosted_video, fetcher = fetch }: {
  hosted_video: HostedVideo
  fetcher?: typeof fetch
}): Promise<HostedMetadata | undefined> {
  try {
    const endpoint = hosted_video.type === 'youtube'
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(hosted_video_url(hosted_video))}`
      : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(hosted_video_url(hosted_video))}`
    const response = await fetcher(endpoint, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(HOSTED_METADATA_TIMEOUT_MS),
    })
    if (!response.ok)
      return undefined
    return metadata_from_oembed(hosted_video.type, await response.json() as OEmbedResponse)
  } catch {
    return undefined
  }
}

if (import.meta.vitest) {
  describe(metadata_from_oembed, () => {
    test('maps normalized Vimeo metadata including description and duration', () => {
      expect(metadata_from_oembed('vimeo', { title: ' Film ', description: ' Notes ', thumbnail_url: ' thumb.jpg ', duration: 64 })).toEqual({
        title: 'Film',
        description: 'Notes',
        thumbnail_url: 'thumb.jpg',
        duration_seconds: 64,
      })
    })

    test('maps YouTube title and thumbnail without inventing unavailable duration', () => {
      expect(metadata_from_oembed('youtube', { title: 'Clip', thumbnail_url: 'yt.jpg', duration: 99 })).toEqual({ title: 'Clip', thumbnail_url: 'yt.jpg' })
    })
  })

  describe(fetch_hosted_video_metadata, () => {
    test('uses the provider endpoint and returns undefined on metadata failure', async () => {
      const calls: string[] = []
      const fetcher = vi.fn((url: string | URL | Request) => {
        calls.push(String(url))
        return Promise.resolve(new Response('unavailable', { status: 503 }))
      }) as typeof fetch
      await expect(fetch_hosted_video_metadata({ hosted_video: { type: 'youtube', video_id: 'abc' }, fetcher })).resolves.toBeUndefined()
      expect(calls[0]).toContain('youtube.com/oembed')
    })
  })
}
