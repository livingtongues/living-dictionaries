import { parseVideoData } from './parseVideoData';

test('parseVideoData properly parses YouTube Ids, even w/ query params like timestamp', () => {
  const id = 'GrsknWZpr-k';
  const expected = { videoId: id, type: 'youtube' };

  expect(parseVideoData(`http://www.youtube.com/watch?v=${id}`)).toEqual(expected);
  expect(parseVideoData(`http://www.youtube.com/watch?v=${id}&t=2113s`)).toEqual(expected);
  expect(parseVideoData(`http://youtu.be/watch?v=${id}`)).toEqual(expected);
  expect(parseVideoData(`https://youtube.googleapis.com/v/${id}`)).toEqual(expected);
});

test('parseVideoData properly parses Vimeo Ids, including relative urls', () => {
  const id = '239862299';
  const expected = { videoId: id, type: 'vimeo' };

  expect(parseVideoData(`http://vimeo.com/${id}`)).toEqual(expected);
  expect(parseVideoData(`http://player.vimeo.com/video/${id}`)).toEqual(expected);
  expect(parseVideoData(`//player.vimeo.com/video/${id}`)).toEqual(expected);
});

test('parseVideoData handles returns null for invalid URL', () => {
  expect(parseVideoData('https://www.nba.com')).toBeNull();
  expect(parseVideoData('https://www.youtube.com')).toBeNull();
});
