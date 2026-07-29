<script lang="ts">
  /**
   * Renders a same-origin HTML document (an import report/preview artifact) in a
   * sandboxed iframe.
   *
   * Security: the artifact is authored by whoever ran the import — our agents
   * today, outside agents tomorrow — so it is NEVER allowed to execute script.
   * Two independent layers enforce that:
   *   1. the serving endpoint sends `Content-Security-Policy: default-src 'none'`
   *      (no `script-src`), so nothing runs even if the document is opened
   *      directly in a tab;
   *   2. this `sandbox` grants no `allow-scripts`.
   * `allow-same-origin` is therefore harmless here (scripts can't run to abuse
   * it) and buys us height measurement; `allow-popups` lets the report's links to
   * live entries open in a new tab.
   *
   * Height auto-fits the content up to `max_height`, after which the frame
   * scrolls — a full report is long, and growing it inline would bury the rest of
   * the conversation.
   */
  interface Props {
    src: string
    title: string
    /** CSS length. Beyond this the frame scrolls internally. */
    max_height?: string
  }
  const { src, title, max_height = '70vh' }: Props = $props()

  let iframe: HTMLIFrameElement | null = $state(null)
  let height = $state(360)

  function measure() {
    try {
      const doc = iframe?.contentDocument
      if (!doc?.body)
        return
      // ONLY body.scrollHeight. `documentElement.scrollHeight` is floored at the
      // iframe's own viewport height, so feeding it back into the height made
      // the frame monotonically grow and never shrink to its content.
      const style = doc.defaultView?.getComputedStyle(doc.body)
      const margins = style ? Number.parseFloat(style.marginTop) + Number.parseFloat(style.marginBottom) : 0
      const next = Math.ceil(doc.body.scrollHeight + (Number.isFinite(margins) ? margins : 0))
      if (next && next !== height)
        height = next
    } catch {
    // Opaque document — keep the default height.
    }
  }

  function on_load() {
    measure()
    try {
      const doc = iframe?.contentDocument
      if (!doc?.body)
        return
      // Report links point at live entries/pages. Without a target they navigate
      // THIS frame — which is sandboxed without `allow-scripts`, so the app loads
      // as a dead scriptless shell inside a 70vh box with no way back. Forced
      // here rather than asked of the artifact authors so every report already
      // filed behaves correctly (all four shipped without a target).
      for (const link of Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
        if (link.getAttribute('href')?.startsWith('#'))
          continue // in-document anchors must stay in the frame
        link.target = '_blank'
        link.rel = 'noopener'
      }
      new ResizeObserver(measure).observe(doc.body)
      for (const image of Array.from(doc.images)) {
        if (!image.complete)
          image.addEventListener('load', measure, { once: true })
      }
    } catch {
    // ignore
    }
  }
</script>

<iframe
  bind:this={iframe}
  {title}
  {src}
  sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
  referrerpolicy="no-referrer"
  onload={on_load}
  style:height={`${height}px`}
  style:max-height={max_height}>
</iframe>

<style>
  iframe {
    display: block;
    width: 100%;
    border: 0;
    background: var(--background);
  }
</style>
