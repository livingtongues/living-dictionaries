import { parseVideoData } from './parseVideoData';

describe('parseVideoData', () => {
  const youtubeId = 'GrsknWZpr-k';
  const vimeoId = '239862299';

  test('handles YouTube urls', () => {
    const youtubeUrls = [
      `http://www.youtube.com/watch?v=${youtubeId}`,
      `http://youtu.be/watch?v=${youtubeId}`,
      `https://youtube.googleapis.com/v/${youtubeId}`,
      `http://www.youtube.com/watch?v=${youtubeId}&t=sahda`,
    ]

    for (const url of youtubeUrls)
      expect(parseVideoData(url)).toEqual({ youtubeId });

  });

  test('handles Youtube timestamps', () => {
    expect(parseVideoData(`http://www.youtube.com/watch?v=${youtubeId}?t=2113s`)).toEqual({ youtubeId, startAt: 2113 });
    expect(parseVideoData(`http://www.youtube.com/watch?v=${youtubeId}&t=20s`)).toEqual({ youtubeId, startAt: 20 });
  });

  test('handles Vimeo urls, including relative urls', () => {
    const vimeoUrls = [
      `http://vimeo.com/${vimeoId}`,
      `http://player.vimeo.com/video/${vimeoId}`,
      `//player.vimeo.com/video/${vimeoId}`,
    ]

    for (const url of vimeoUrls)
      expect(parseVideoData(url)).toEqual({ vimeoId });

  });

  test('handles Vimeo timestamps', () => {
    expect(parseVideoData(`http://player.vimeo.com/video/${vimeoId}#t=64`)).toEqual({ vimeoId, startAt: 64 });
    expect(parseVideoData(`http://player.vimeo.com/video/${vimeoId}&t=64`)).toEqual({ vimeoId, startAt: 64 });
  });

  test('returns null for invalid URLs', () => {
    expect(parseVideoData('https://www.nba.com')).toBeNull();
    expect(parseVideoData('https://www.youtube.com')).toBeNull();
  });
})
