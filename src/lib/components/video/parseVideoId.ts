export function parseVideoId(url: string): { videoId: string; type: 'vimeo' | 'youtube' } {
  const videoIdParseRegex =
    /(http:|https:|)\/\/(player.|www.)?(vimeo\.com|youtu(be\.com|\.be|be\.googleapis\.com))\/(video\/|embed\/|watch\?v=|v\/)?([A-Za-z0-9._%-]*)(&\S+)?/;
  const match = url.match(videoIdParseRegex);

  if (match) {
    if (match[3].indexOf('youtu') > -1) {
      return { videoId: match[6], type: 'youtube' };
    } else if (match[3].indexOf('vimeo') > -1) {
      return { videoId: match[6], type: 'vimeo' };
    }
  }
  return null;
}
