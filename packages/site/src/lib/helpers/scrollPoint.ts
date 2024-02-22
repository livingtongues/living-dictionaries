import { tick } from 'svelte'

// export function sliceUrl(url: string): string {
//   return url.slice(0, url.lastIndexOf('/'));
// }


// export function getScrollPointFromLocalStorage(local_storage_scroll_point_key: string): number {
//   return parseInt(sessionStorage.getItem(local_storage_scroll_point_key)) || 0
// }

export function save_scroll_point(url: string) {
  const pixels_from_top = window.scrollY
  const last_scroll_point = {
    url,
    pixels_from_top,
  }
  sessionStorage.setItem('entries_scroll_point', JSON.stringify(last_scroll_point))
}

export async function restore_scroll_point() {
  const url = window.location.href
  // eslint-disable-next-line no-console
  console.log({url})
  const last_scroll_point = JSON.parse(sessionStorage.getItem('entries_scroll_point'))
  if (last_scroll_point && last_scroll_point.url === url) {
    await tick()
    window.scrollTo(0, last_scroll_point.pixels_from_top)
    sessionStorage.setItem('entries_scroll_point', null)
  }
}
