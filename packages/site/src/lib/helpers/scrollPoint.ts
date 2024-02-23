import { tick } from 'svelte';

// Temporal solution until we no longer depend on Algolia. After tha we will rely on snapshots: https://svelte.dev/blog/streaming-snapshots-sveltekit#snapshots and only use history back()

export function save_scroll_point(url: string, pixels_from_top: number) {
  const last_scroll_point = {
    url,
    pixels_from_top,
  }
  sessionStorage.setItem('entries_scroll_point', JSON.stringify(last_scroll_point))
}

export async function restore_scroll_point() {
  const url = window.location.href;
  const last_scroll_point = JSON.parse(sessionStorage.getItem('entries_scroll_point'));
  if (last_scroll_point && last_scroll_point.url === url) {
    await tick();
    window.scrollTo(0, last_scroll_point.pixels_from_top);
    sessionStorage.setItem('entries_scroll_point', null);
  }
}
