export function sliceUrl(url: string): string {
  return url.slice(0, url.lastIndexOf('/'));
}

export function getScrollPointFromLocalStorage(): number {
  return parseInt(localStorage.getItem('list_scroll_point')) || 0
}

