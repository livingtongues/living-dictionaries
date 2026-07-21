import type { HostedVideo } from '$lib/types'

function parse_start_seconds(value: string | null): number | undefined {
  if (!value)
    return undefined
  if (/^\d+$/.test(value))
    return Number(value)
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/)
  if (!match)
    return undefined
  const seconds = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)
  return seconds || undefined
}

function with_start(hosted_video: HostedVideo, url: URL): HostedVideo {
  const hash_params = new URLSearchParams(url.hash.replace(/^#/, ''))
  const start_at_seconds = parse_start_seconds(url.searchParams.get('t') ?? url.searchParams.get('start') ?? hash_params.get('t'))
  return start_at_seconds ? { ...hosted_video, start_at_seconds } : hosted_video
}

export function parse_hosted_video_url(value: string): HostedVideo | undefined {
  let url: URL
  try {
    url = new URL(value.trim().startsWith('//') ? `https:${value.trim()}` : value.trim())
  } catch {
    return undefined
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const segments = url.pathname.split('/').filter(Boolean)

  if (host === 'youtu.be') {
    const video_id = url.searchParams.get('v') ?? segments[0]
    return video_id ? with_start({ type: 'youtube', video_id }, url) : undefined
  }

  if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'youtube.googleapis.com'].includes(host)) {
    const video_id = url.pathname === '/watch'
      ? url.searchParams.get('v')
      : ['embed', 'v', 'shorts', 'live'].includes(segments[0]) ? segments[1] : undefined
    return video_id ? with_start({ type: 'youtube', video_id }, url) : undefined
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const video_id = segments[0] === 'video' ? segments[1] : segments[0]
    return video_id && /^\d+$/.test(video_id) ? with_start({ type: 'vimeo', video_id }, url) : undefined
  }

  return undefined
}

if (import.meta.vitest) {
  describe(parse_hosted_video_url, () => {
    const youtube_id = 'GrsknWZpr-k'
    const vimeo_id = '239862299'

    test('normalizes YouTube watch, share, embed, shorts, and legacy API URLs', () => {
      const urls = [
        `https://www.youtube.com/watch?v=${youtube_id}`,
        `https://youtu.be/${youtube_id}`,
        `https://www.youtube.com/embed/${youtube_id}`,
        `https://youtube.com/shorts/${youtube_id}`,
        `https://youtube.googleapis.com/v/${youtube_id}`,
      ]
      for (const url of urls)
        expect(parse_hosted_video_url(url)).toEqual({ video_id: youtube_id, type: 'youtube' })
    })

    test('normalizes YouTube timestamp formats', () => {
      expect(parse_hosted_video_url(`https://youtube.com/watch?v=${youtube_id}&t=2113s`)).toEqual({ video_id: youtube_id, type: 'youtube', start_at_seconds: 2113 })
      expect(parse_hosted_video_url(`https://youtu.be/${youtube_id}?t=1h2m3s`)).toEqual({ video_id: youtube_id, type: 'youtube', start_at_seconds: 3723 })
      expect(parse_hosted_video_url(`https://youtube.com/embed/${youtube_id}?start=20`)).toEqual({ video_id: youtube_id, type: 'youtube', start_at_seconds: 20 })
    })

    test('normalizes Vimeo page and player URLs with timestamps', () => {
      expect(parse_hosted_video_url(`https://vimeo.com/${vimeo_id}`)).toEqual({ video_id: vimeo_id, type: 'vimeo' })
      expect(parse_hosted_video_url(`//player.vimeo.com/video/${vimeo_id}#t=1m4s`)).toEqual({ video_id: vimeo_id, type: 'vimeo', start_at_seconds: 64 })
    })

    test('rejects invalid providers and provider pages without an id', () => {
      expect(parse_hosted_video_url('https://www.nba.com')).toBeUndefined()
      expect(parse_hosted_video_url('https://www.youtube.com')).toBeUndefined()
      expect(parse_hosted_video_url('https://vimeo.com/channels/staffpicks')).toBeUndefined()
    })
  })
}
