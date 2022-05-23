import { parseVideoData } from './parseVideoData';

test('parseVideoData properly parses YouTube Ids, even w/ query params like timestamp', () => {
  const id = 'GrsknWZpr-k';
  const expectedWithoutStart = { videoId: id, type: 'youtube', startAt: undefined };
  const expectedWithStart = {
    videoId: id,
    type: 'youtube',
    startAt: '2113',
  };

  expect(parseVideoData(`http://www.youtube.com/watch?v=${id}`)).toEqual(expectedWithoutStart);
  expect(parseVideoData(`http://www.youtube.com/watch?v=${id}?t=2113s`)).toEqual(expectedWithStart);
  expect(parseVideoData(`http://www.youtube.com/watch?v=${id}&t=2113s`)).toEqual(expectedWithStart);
  expect(parseVideoData(`http://youtu.be/watch?v=${id}`)).toEqual(expectedWithoutStart);
  expect(parseVideoData(`https://youtube.googleapis.com/v/${id}`)).toEqual(expectedWithoutStart);
});

test('parseVideoData properly parses Vimeo Ids, including relative urls', () => {
  const id = '239862299';
  const expectedWithoutStart = { videoId: id, type: 'vimeo', startAt: undefined };
  const expectedWithStart = {
    videoId: id,
    type: 'vimeo',
    startAt: '64',
  };

  expect(parseVideoData(`http://vimeo.com/${id}`)).toEqual(expectedWithoutStart);
  expect(parseVideoData(`http://player.vimeo.com/video/${id}`)).toEqual(expectedWithoutStart);
  expect(parseVideoData(`//player.vimeo.com/video/${id}`)).toEqual(expectedWithoutStart);
  expect(parseVideoData(`http://player.vimeo.com/video/${id}#t=64`)).toEqual(expectedWithStart);
});

test('parseVideoData handles returns null for invalid URL', () => {
  expect(parseVideoData('https://www.nba.com')).toBeNull();
  expect(parseVideoData('https://www.youtube.com')).toBeNull();
});
