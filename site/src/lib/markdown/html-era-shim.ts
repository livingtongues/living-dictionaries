import { render_markdown_to_html } from './render'

/**
 * TRANSITION SHIM — DELETE AFTER THE SUPABASE CUTOVER.
 *
 * Rich-text fields (dictionary about/grammar, entry notes) store markdown, but
 * rows written before the CKEditor→Tiptap swap (staging + pre-cutover prod
 * format) still hold HTML. The cutover migration converts everything to
 * markdown; until then readers must not garble HTML-era content.
 *
 * CKEditor output always starts with a block tag (`<p>`, `<h2>`, `<figure>`,
 * `<ul>`, …) so a leading `<` is a reliable discriminator — markdown authored
 * in the new editor never starts with `<`.
 */
export function looks_like_html(value: string): boolean {
  return /^\s*</.test(value || '')
}

/**
 * Display path: HTML-era content renders as-is (it IS html — no DOM-needing
 * conversion, safe under SSR); markdown renders through markdown-it.
 * Callers MUST still `sanitize()` the result before `{@html}`.
 */
export function rich_text_display_html(value: string | undefined | null): string {
  if (!value)
    return ''
  if (looks_like_html(value))
    return value
  return render_markdown_to_html(value)
}
