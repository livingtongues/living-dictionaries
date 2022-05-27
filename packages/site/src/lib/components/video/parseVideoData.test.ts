import { parseVideoData } from './parseVideoData';

test('parseVideoData properly parses YouTube Ids, even w/ query params like timestamp', () => {
  const id = 'GrsknWZpr-k';

  expect(parseVideoData(`http://www.youtube.com/watch?v=${id}`)).toMatchInlineSnapshot(`
    {
      "youtubeId": "GrsknWZpr-k",
    }
  `);
  expect(parseVideoData(`http://www.youtube.com/watch?v=${id}`)).toMatchInlineSnapshot(`
    {
      "youtubeId": "GrsknWZpr-k",
    }
  `);
  expect(parseVideoData(`http://www.youtube.com/watch?v=${id}?t=2113s`)).toMatchInlineSnapshot(`
    {
      "startAt": 2113,
      "youtubeId": "GrsknWZpr-k",
    }
  `);
  expect(parseVideoData(`http://www.youtube.com/watch?v=${id}&t=20s`)).toMatchInlineSnapshot(`
    {
      "startAt": 20,
      "youtubeId": "GrsknWZpr-k",
    }
  `);
  expect(parseVideoData(`http://youtu.be/watch?v=${id}`)).toMatchInlineSnapshot(`
    {
      "youtubeId": "GrsknWZpr-k",
    }
  `);
  expect(parseVideoData(`https://youtube.googleapis.com/v/${id}`)).toMatchInlineSnapshot(`
    {
      "youtubeId": "GrsknWZpr-k",
    }
  `);
  expect(parseVideoData(`http://www.youtube.com/watch?v=${id}&t=sahda`)).toMatchInlineSnapshot(`
    {
      "youtubeId": "GrsknWZpr-k",
    }
  `);
});

test('parseVideoData properly parses Vimeo Ids, including relative urls', () => {
  const id = '239862299';
  expect(parseVideoData(`http://vimeo.com/${id}`)).toMatchInlineSnapshot(`
    {
      "vimeoId": "239862299",
    }
  `);
  expect(parseVideoData(`http://player.vimeo.com/video/${id}`)).toMatchInlineSnapshot(`
    {
      "vimeoId": "239862299",
    }
  `);
  expect(parseVideoData(`//player.vimeo.com/video/${id}`)).toMatchInlineSnapshot(`
    {
      "vimeoId": "239862299",
    }
  `);
  expect(parseVideoData(`http://player.vimeo.com/video/${id}#t=64`)).toMatchInlineSnapshot(`
    {
      "startAt": 64,
      "vimeoId": "239862299",
    }
  `);
  expect(parseVideoData(`http://player.vimeo.com/video/${id}&t=64`)).toMatchInlineSnapshot(`
    {
      "startAt": 64,
      "vimeoId": "239862299",
    }
  `);
});

test('parseVideoData handles returns null for invalid URL', () => {
  expect(parseVideoData('https://www.nba.com')).toBeNull();
  expect(parseVideoData('https://www.youtube.com')).toBeNull();
});
