/**
 * Strip the layout cruft Tiptap injects when it serializes a table to HTML
 * (ported verbatim from house `site/src/lib/markdown/clean-tables.ts`):
 *  - `<table style="min-width…">` + a `<colgroup><col style="min-width…">` per
 *    column (auto column-width declarations — noise no one authored),
 *  - redundant `colspan="1"` / `rowspan="1"` (real spans like `colspan="3"` stay),
 *  - the `<p>` wrapper Tiptap puts around single-paragraph cell content — the
 *    source of the extra space AFTER each cell's text (its bottom margin).
 *
 * Runs on the serialized markdown string (which carries table blocks as raw
 * HTML), touching ONLY `<table>…</table>` spans. Needs a DOM — always true where
 * this runs (browser editor + happy-dom for the cutover conversion/tests), same
 * as `html_to_markdown`.
 */
export function clean_table_markup(markdown: string): string {
  if (!markdown.includes('<table'))
    return markdown
  return markdown.replace(/<table[\s\S]*?<\/table>/gi, block => clean_one_table(block))
}

function clean_one_table(table_html: string): string {
  const host = document.createElement('div')
  host.innerHTML = table_html
  const table = host.querySelector('table')
  if (!table)
    return table_html

  table.removeAttribute('style')
  table.querySelectorAll('colgroup').forEach(node => node.remove())

  for (const cell of Array.from(table.querySelectorAll('td, th'))) {
    cell.removeAttribute('style')
    if (cell.getAttribute('colspan') === '1')
      cell.removeAttribute('colspan')
    if (cell.getAttribute('rowspan') === '1')
      cell.removeAttribute('rowspan')

    // Unwrap a lone <p> so a simple cell holds inline content directly (no
    // trailing-margin gap, cleaner source). Multi-block cells keep their <p>s.
    const only_child = cell.children.length === 1 ? cell.children[0] : null
    if (only_child && only_child.tagName === 'P')
      cell.innerHTML = only_child.innerHTML
  }

  return table.outerHTML
}
