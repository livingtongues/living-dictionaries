export function sliceUrl(url: string): string {
  return url.slice(0, url.lastIndexOf('/'));
}

export function getScrollPointFromLocalStorage(local_storage_scroll_point_key: string): number {
  return parseInt(localStorage.getItem(local_storage_scroll_point_key)) || 0
}

