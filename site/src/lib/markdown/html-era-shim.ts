import { render_markdown_to_html } from './render'

/**
 * TRANSITION SHIM — DELETE AFTER THE SUPABASE CUTOVER.
 *
 * Rich-text fields (dictionary about/grammar, entry notes) store markdown, but
 * rows written before the CKEditor→Tiptap swap (staging + pre-cutover prod
 * format) still hold HTML. The cutover migration converts everything to
 * markdown; until then readers must not garble HTML-era content.
 *
 * CKEditor output always starts with a block TAG (`<p>`, `<h2>`, `<figure>`,
 * `<ul>`, `<div>`, `<table>`, `<blockquote>`, …). Requiring `<` + a tag-name
 * letter / `/` / `!` (not a bare `<`) is what makes it reliable: real content
 * can legitimately START with `<` as text — a `<< pa` citation marker, a `<3`,
 * `< 5`, a `<https://…>` autolink — and those must NOT be fed to the HTML
 * parser (it swallows `<<word` as a bogus tag and drops the text). Markdown
 * authored in the new editor never starts with a `<tag`.
 */
export function looks_like_html(value: string): boolean {
  // `<!`/`</` OR `<tagname` immediately followed by whitespace, `>`, or `/`.
  // The trailing-char requirement is what rejects a `<https://…>` autolink
  // (tag-name chars then `:`) while accepting `<h2>` / `<div class=…>`.
  return /^\s*<(?:[!/]|[a-z][a-z0-9]*[\s/>])/i.test(value || '')
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
