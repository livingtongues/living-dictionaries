import { parseVideoId } from './parseVideoId';

test('parseVideoId properly parses YouTube Ids, even w/ query params like timestamp', () => {
  const id = 'GrsknWZpr-k';
  const expected = { videoId: id, type: 'youtube' };

  expect(parseVideoId(`http://www.youtube.com/watch?v=${id}`)).toEqual(expected);
  expect(parseVideoId(`http://www.youtube.com/watch?v=${id}&t=2113s`)).toEqual(expected);
  expect(parseVideoId(`http://youtu.be/watch?v=${id}`)).toEqual(expected);
  expect(parseVideoId(`https://youtube.googleapis.com/v/${id}`)).toEqual(expected);
});

test('parseVideoId properly parses Vimeo Ids, including relative urls', () => {
  const id = '239862299';
  const expected = { videoId: id, type: 'vimeo' };

  expect(parseVideoId(`http://vimeo.com/${id}`)).toEqual(expected);
  expect(parseVideoId(`http://player.vimeo.com/video/${id}`)).toEqual(expected);
  expect(parseVideoId(`//player.vimeo.com/video/${id}`)).toEqual(expected);
});

test('parseVideoId handles returns null for invalid URL', () => {
  expect(parseVideoId('https://www.nba.com')).toBeNull();
  expect(parseVideoId('https://www.youtube.com')).toBeNull();
});
