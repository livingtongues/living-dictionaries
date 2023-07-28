import type { GoalDatabaseVideo } from '@living-dictionaries/types';

export function parseVideoData(url: string): GoalDatabaseVideo {
  const videoIdParseRegex =
    /(http:|https:|)\/\/(player.|www.)?(vimeo\.com|youtu(be\.com|\.be|be\.googleapis\.com))\/(video\/|embed\/|watch\?v=|v\/)?([A-Za-z0-9._%-]*)?([?&#]t=[0-9]+)?/;
  const match = url.match(videoIdParseRegex);

  if (match) {
    const video: GoalDatabaseVideo = {};
    if (match[3].indexOf('youtu') > -1) {
      video.youtubeId = match[6];
    } else if (match[3].indexOf('vimeo') > -1) {
      video.vimeoId = match[6];
    }
    if (match[7]) {
      video.startAt = +match[7].match(/[0-9]+/)[0];
    }
    return video;
  }
  return null;
}
