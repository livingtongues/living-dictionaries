<script lang="ts">
  /**
   * Renders an inbound email's HTML body inside a sandboxed iframe.
   *
   * Used by the admin thread viewer for messages where the customer's email
   * had no plaintext part (marketing senders, phishing, Stripe receipts, etc.).
   *
   * Security:
   * - `sandbox="allow-same-origin"` — scripts in the email body do NOT execute
   *   (no allow-scripts), forms cannot submit (no allow-forms), top-level
   *   navigation is blocked (no allow-top-navigation), popups blocked, etc.
   *   The only privilege granted is same-origin, which is needed so the parent
   *   can measure the iframe's contentDocument height for auto-fit.
   * - `srcdoc` carries the HTML inline (no network load, no opportunity for
   *   the email to embed a top-level malicious URL).
   * - We wrap the body in our own scaffold that sets `color-scheme: light dark`
   *   and a max-width so the email reflows reasonably inside the admin layout.
   *
   * Auto-resize: on iframe `load`, we read `contentDocument.body.scrollHeight`
   * and apply it as the iframe height. Re-measures via ResizeObserver if the
   * inner document changes layout (image loads, etc.).
   */
  interface Props {
    html: string
  }
  let { html }: Props = $props()

  let iframe: HTMLIFrameElement | null = $state(null)
  let height = $state(200)

  /**
   * Inline style + base[target=_blank] injection that works whether the email's
   * HTML is a fragment or a full `<html>` document. We always wrap so the
   * outer iframe gets our reset/theme styles; nested html/body tags inside
   * the body are well-tolerated by browsers.
   */
  /**
   * Email HTML is authored against a white reading-pane background by senders.
   * We force `color-scheme: only light` and a white body bg so the email
   * renders consistently regardless of admin's system dark-mode preference.
   * (This matches Gmail/Outlook reading-pane behavior.) The email's own
   * `prefers-color-scheme` media queries are effectively suppressed by the
   * `color-scheme: only light` declaration.
   */
  const srcdoc = $derived(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="only light">
<base target="_blank">
<style>
  :root { color-scheme: only light; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #1a1a1a;
    background: #ffffff;
    padding: 12px;
    box-sizing: border-box;
    overflow-x: auto;
    word-break: break-word;
  }
  img, table, video { max-width: 100%; height: auto; }
  table { border-collapse: collapse; }
  pre { white-space: pre-wrap; word-break: break-word; }
  a { color: #9333ea; }
</style>
</head>
<body>${html}</body>
</html>`)

  function measure() {
    if (!iframe) return
    try {
      const doc = iframe.contentDocument
      if (!doc?.body) return
      const next = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight)
      if (next && next !== height)
        height = next
    } catch {
      // cross-origin (shouldn't happen with allow-same-origin + srcdoc, but be safe)
    }
  }

  function on_load() {
    measure()
    // Late-loading images, web fonts, etc. — re-measure on resize of inner doc.
    try {
      const doc = iframe?.contentDocument
      if (!doc?.body) return
      const ro = new ResizeObserver(measure)
      ro.observe(doc.body)
      // Also re-measure when images inside finish loading
      for (const img of Array.from(doc.images)) {
        if (!img.complete)
          img.addEventListener('load', measure, { once: true })
      }
    } catch {
      // ignore
    }
  }
</script>

<iframe
  bind:this={iframe}
  title="Email HTML content"
  sandbox="allow-same-origin"
  srcdoc={srcdoc}
  onload={on_load}
  class="email-iframe"
  style:height={`${height}px`}>
</iframe>

<style>
  .email-iframe {
    display: block;
    width: 100%;
    border: 0;
    border-radius: 0.375rem;
    background: white;
  }
</style>
