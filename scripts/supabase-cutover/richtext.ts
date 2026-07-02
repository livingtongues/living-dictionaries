import type { Row } from './mappers'
import { create_conversion_stats } from './conversion-stats'
import type { ConversionMismatch, ConversionStats } from './conversion-stats'
import { refresh_dom, register_dom } from './register-dom'

export { create_conversion_stats }
export type { ConversionMismatch, ConversionStats }

register_dom() // must precede the site markdown imports (tiptap touches DOM globals at import time)

// eslint-disable-next-line import/first
import { html_to_markdown } from '../../site/src/lib/markdown/html-to-markdown'
// eslint-disable-next-line import/first
import { looks_like_html } from '../../site/src/lib/markdown/html-era-shim'
// eslint-disable-next-line import/first
import { render_markdown_to_html } from '../../site/src/lib/markdown/render'

/**
 * Cutover rich-text conversion: CKEditor-era HTML → markdown through the SAME
 * Tiptap extension set the live editor uses (`site/src/lib/markdown/`), under
 * happy-dom. Applies to `dictionaries.about` / `dictionaries.grammar` and every
 * locale value of `entries.notes`. Values that don't look like HTML pass
 * through untouched (plain text is valid markdown).
 *
 * Every conversion is VERIFIED: the markdown is rendered back to HTML and both
 * sides' normalized text content are compared. Mismatches don't block the run —
 * they're collected (with ids + before/after) for eyeball review.
 */

let conversions_since_refresh = 0

/** Convert one value if it's HTML-era; verify; record stats. Returns the stored value (null for empty). */
export function convert_value({ value, where, stats }: { value: unknown, where: string, stats: ConversionStats }): string | null {
  if (value === null || value === undefined)
    return null
  const text = String(value)
  if (!text.trim()) {
    stats.emptied++
    return null
  }
  if (!looks_like_html(text)) {
    stats.passed_through++
    return text
  }

  // CKEditor media embeds (`<oembed url="…">`) have no Tiptap extension — the
  // audit found 5. Preserve the URL as a plain link instead of dropping it.
  const prepared = text.replace(/<oembed[^>]*\burl="([^"]+)"[^>]*>(?:<\/oembed>)?/gi, '<p><a href="$1">$1</a></p>')

  // happy-dom retains everything reachable from its window → swap in a fresh
  // one periodically or a full-corpus run OOMs (~750KB retained per call).
  if (++conversions_since_refresh >= 200) {
    conversions_since_refresh = 0
    refresh_dom()
  }

  const markdown = html_to_markdown(prepared)
  stats.converted++
  if (!markdown.trim()) {
    // HTML that converts to nothing (e.g. `<p>&nbsp;</p>`) → store null, but
    // flag it if the original actually had text content.
    const original_text = normalized_text_of_html(text)
    if (original_text) {
      stats.mismatches.push({ where, original_html: clip(text), markdown: '', original_text: clip(original_text), roundtrip_text: '' })
      return markdown // keep the (empty) conversion honest; the mismatch log has the evidence
    }
    stats.emptied++
    return null
  }

  const original_text = normalized_text_of_html(text)
  const roundtrip_text = normalized_text_of_html(render_markdown_to_html(markdown))
  if (original_text !== roundtrip_text) {
    // Store context AROUND the first divergence — a clipped prefix hides it.
    let divergence = 0
    while (divergence < original_text.length && original_text[divergence] === roundtrip_text[divergence])
      divergence++
    const window_start = Math.max(0, divergence - 60)
    stats.mismatches.push({
      where,
      original_html: clip(text),
      markdown: clip(markdown),
      original_text: `…${original_text.slice(window_start, divergence + 120)}`,
      roundtrip_text: `…${roundtrip_text.slice(window_start, divergence + 120)}`,
    })
  }
  return markdown
}

/**
 * Convert a MultiString (`{ locale: html }`) in place-style: returns a new map
 * with each locale converted; empty locales are dropped entirely.
 */
export function convert_multistring({ value, where, stats }: { value: unknown, where: string, stats: ConversionStats }): Row | null {
  if (!value || typeof value !== 'object')
    return null
  const result: Row = {}
  for (const [locale, locale_value] of Object.entries(value as Row)) {
    const converted = convert_value({ value: locale_value, where: `${where}.${locale}`, stats })
    if (converted !== null && converted !== '')
      result[locale] = converted
  }
  return Object.keys(result).length ? result : null
}

/**
 * ALL whitespace is stripped before comparing: block-element boundaries produce
 * different (cosmetic) spacing between a DOM textContent and a markdown
 * re-render — what we're guarding against is DROPPED TEXT, not spacing.
 */
function normalized_text_of_html(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return (doc.body?.textContent ?? '').replace(/\s+/g, '')
}

function clip(text: string, max = 600): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}
