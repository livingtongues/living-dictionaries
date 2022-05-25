export function parseVideoData(url: string): {
  videoId: string;
  type: 'vimeo' | 'youtube';
  startAt: string;
} {
  const videoIdParseRegex =
    /(http:|https:|)\/\/(player.|www.)?(vimeo\.com|youtu(be\.com|\.be|be\.googleapis\.com))\/(video\/|embed\/|watch\?v=|v\/)?([A-Za-z0-9._%-]*)?([?&#]t=[0-9]+)?/;
  const match = url.match(videoIdParseRegex);

  if (match) {
    if (match[3].indexOf('youtu') > -1) {
      return {
        videoId: match[6],
        type: 'youtube',
        startAt: match[7]
          ?.toString()
          .match(/[0-9]+/)
          .toString(),
      };
    } else if (match[3].indexOf('vimeo') > -1) {
      return {
        videoId: match[6],
        type: 'vimeo',
        startAt: match[7]
          ?.toString()
          .match(/[0-9]+/)
          .toString(),
      };
    }
  }
  return null;
}
