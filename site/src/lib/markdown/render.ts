import MarkdownIt from 'markdown-it'
import { configure_pandoc_spans } from './markdown-it-pandoc-spans'

/**
 * Rich-text markdown → HTML for reader views (about/grammar pages, entry
 * notes, print). Kept on the SAME markdown-it config tiptap-markdown parses
 * with (raw HTML on, no linkify, no breaks) so editor == reader. Callers MUST
 * pass the result through `sanitize()` before `{@html}` — LD content is
 * manager-authored by many external users.
 */
let renderer: MarkdownIt | null = null

function get_renderer(): MarkdownIt {
  if (!renderer) {
    renderer = new MarkdownIt({ html: true, linkify: false, breaks: false })
    configure_pandoc_spans(renderer) // `[text]{.smallcaps}` → <span class="smallcaps">
  }
  return renderer
}

export function render_markdown_to_html(markdown: string): string {
  if (!markdown || !markdown.trim())
    return ''
  return get_renderer().render(markdown)
}
