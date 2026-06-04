/**
 * Browser-only helper for inserting a `<script>` tag exactly once per URL
 * across the page lifetime. Used by integrations that pull a third-party SDK
 * at runtime (Google Identity Services) instead of bundling it.
 *
 * Idempotent: subsequent calls for the same URL resolve immediately without
 * inserting a duplicate tag.
 *
 * Minimal inline copy; the full version lives in svelte-pieces and will land
 * via L9 — at which point this file goes away in favor of the import.
 */

function load_script(url: string) {
  return new Promise<Event>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export const load_script_once = (() => {
  const loaded: string[] = []
  return async function (url: string) {
    if (!loaded.includes(url)) {
      await load_script(url)
      loaded.push(url)
    }
    return true
  }
})()
