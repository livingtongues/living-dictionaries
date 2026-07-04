/**
 * HTML-vs-markdown detection for the Supabase→SQLite migration. CKEditor-era
 * rows (pre-cutover Supabase) store HTML; the migration converts them to
 * markdown. This heuristic decides which values need conversion.
 *
 * CKEditor output always starts with a block TAG (`<p>`, `<h2>`, `<figure>`,
 * `<ul>`, `<div>`, `<table>`, `<blockquote>`, …). Requiring `<` + a tag-name
 * letter / `/` / `!` (not a bare `<`) is what makes it reliable: real content
 * can legitimately START with `<` as text — a `<< pa` citation marker, a `<3`,
 * `< 5`, a `<https://…>` autolink — and those must NOT be fed to the HTML
 * parser (it swallows `<<word` as a bogus tag and drops the text). Markdown
 * authored in the new editor never starts with a `<tag`.
 *
 * Lived in the site as `html-era-shim.ts` during the cutover; the site no
 * longer needs it (all content is markdown), so it moved here with the rest of
 * the migration tooling.
 */
export function looks_like_html(value: string): boolean {
  return /^\s*<(?:[!/]|[a-z][a-z0-9]*[\s/>])/i.test(value || '')
}
