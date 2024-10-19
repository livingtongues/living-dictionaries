import type { HostedVideo } from '@living-dictionaries/types'

export function parse_hosted_video_url(url: string): HostedVideo {
  const videoIdParseRegex
    = /(http:|https:|)\/\/(player.|www.)?(vimeo\.com|youtu(be\.com|\.be|be\.googleapis\.com))\/(video\/|embed\/|watch\?v=|v\/)?([\w.%-]*)([?&#]t=\d+)?/
  const match = url.match(videoIdParseRegex)

  if (!match) return

  const [,,,domain,,,videoId, startTime] = match
  const start_at_seconds = startTime ? +startTime.match(/\d+/)[0] : null

  if (domain.includes('youtu')) {
    return {
      video_id: videoId,
      type: 'youtube',
      ...(start_at_seconds && { start_at_seconds }),
    }
  } else if (domain.includes('vimeo')) {
    return {
      video_id: videoId,
      type: 'vimeo',
      ...(start_at_seconds && { start_at_seconds }),
    }
  }

  // would like to use named capturing goups but it breaks a test
  // const videoIdParseRegex = /(?<protocol>https?:)\/\/(?<subdomain>player\.|www\.)?(?<domain>vimeo\.com|youtu(?:be\.com|\.be|be\.googleapis\.com))\/(?<path>video\/|embed\/|watch\?v=|v\/)?(?<videoId>[\w.%-]*)(?<startTime>[?&#]t=\d+)?/
  // const match = url.match(videoIdParseRegex)

  // if (match?.groups) {
  //   const { domain, videoId, startTime } = match.groups
  // }
}

if (import.meta.vitest) {
  describe(parse_hosted_video_url, () => {
    const youtubeId = 'GrsknWZpr-k'
    const vimeoId = '239862299'

    test('handles YouTube urls', () => {
      const youtubeUrls = [
        `http://www.youtube.com/watch?v=${youtubeId}`,
        `http://youtu.be/watch?v=${youtubeId}`,
        `https://youtube.googleapis.com/v/${youtubeId}`,
        `http://www.youtube.com/watch?v=${youtubeId}&t=sahda`,
      ]

      for (const url of youtubeUrls)
        expect(parse_hosted_video_url(url)).toEqual({ video_id: youtubeId, type: 'youtube' })
    })

    test('handles Youtube timestamps', () => {
      expect(parse_hosted_video_url(`http://www.youtube.com/watch?v=${youtubeId}?t=2113s`)).toEqual({ video_id: youtubeId, type: 'youtube', start_at_seconds: 2113 })
      expect(parse_hosted_video_url(`http://www.youtube.com/watch?v=${youtubeId}&t=20s`)).toEqual({ video_id: youtubeId, type: 'youtube', start_at_seconds: 20 })
    })

    test('handles Vimeo urls, including relative urls', () => {
      const vimeoUrls = [
        `http://vimeo.com/${vimeoId}`,
        `http://player.vimeo.com/video/${vimeoId}`,
        `//player.vimeo.com/video/${vimeoId}`,
      ]

      for (const url of vimeoUrls)
        expect(parse_hosted_video_url(url)).toEqual({ video_id: vimeoId, type: 'vimeo' })
    })

    test('handles Vimeo timestamps', () => {
      expect(parse_hosted_video_url(`http://player.vimeo.com/video/${vimeoId}#t=64`)).toEqual({ video_id: vimeoId, type: 'vimeo', start_at_seconds: 64 })
      expect(parse_hosted_video_url(`http://player.vimeo.com/video/${vimeoId}&t=64`)).toEqual({ video_id: vimeoId, type: 'vimeo', start_at_seconds: 64 })
    })

    test('returns null for invalid URLs', () => {
      expect(parse_hosted_video_url('https://www.nba.com')).toBeUndefined()
      expect(parse_hosted_video_url('https://www.youtube.com')).toBeUndefined()
    })
  })
}
