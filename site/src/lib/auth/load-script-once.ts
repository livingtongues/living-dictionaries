/**
 * Browser-only helper for inserting a `<script>` tag exactly once per URL
 * across the page lifetime. Used by integrations that pull a third-party SDK
 * at runtime (Google Identity Services) instead of bundling it.
 *
 * Idempotent: subsequent calls for the same URL resolve immediately without
 * inserting a duplicate tag.
 *
 * Minimal inline copy; the full version lives in `$lib/utils/load-once` and
 * will land via L9 — at which point this file goes away in favor of the import.
 */

interface LoadScriptOptions {
  /**
   * Opt in to `crossorigin="anonymous"`, which un-masks the browser's opaque
   * "Script error." for throws inside the third-party script.
   *
   * PER-ORIGIN ONLY, and only after checking that origin's real response
   * headers (`curl -sI -H 'Origin: https://livingdictionaries.app' <url>`).
   * The attribute turns the load into a CORS request: an origin that does NOT
   * return `Access-Control-Allow-Origin` then refuses the script entirely
   * rather than merely staying opaque. `accounts.google.com/gsi/client` is the
   * live proof — it returns no ACAO, and the attribute silently killed Google
   * sign-in (2026-08-02). Never blanket-enable this.
   */
  cors?: boolean
}

function load_script({ url, cors }: { url: string, cors: boolean }) {
  return new Promise<Event>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.async = true
    if (cors)
      script.crossOrigin = 'anonymous'
    script.onload = resolve
    // reject with a real Error, not the raw error Event — an uncaught raw
    // Event surfaces as a useless "Event" pageerror/telemetry row
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`))
    document.head.appendChild(script)
  })
}

export const load_script_once = (() => {
  const loaded: string[] = []
  return async function (url: string, { cors = false }: LoadScriptOptions = {}) {
    if (!loaded.includes(url)) {
      await load_script({ url, cors })
      loaded.push(url)
    }
    return true
  }
})()
