import { Editor } from '@tiptap/core'
import { generateJSON } from '@tiptap/html'
import { create_markdown_extensions, get_editor_markdown } from './extensions'

/**
 * Convert one block of CKEditor-era HTML → markdown, through the SAME Tiptap
 * extension set the editor uses — so a converted doc reloaded into the editor
 * is byte-stable (no spurious first-save churn). Used client-side at edit-open
 * time (the html-era shim) and by the Supabase-cutover migration (under
 * happy-dom — see house `site/src/lib/markdown/backfill/` for the pattern).
 *
 * Two-step because `tiptap-markdown` treats a `content` STRING as markdown:
 * first parse HTML → ProseMirror JSON with `generateJSON` (needs a DOM), then
 * feed the JSON (unambiguous) to a headless editor and read markdown out.
 *
 * text-align is dropped by the extension set; `<u>` becomes the lossless
 * `[…]{.underline}` span (see `create_markdown_extensions`) — EXCEPT inside a
 * link, where it's redundant styling AND its brackets would corrupt the
 * markdown link syntax, so it's unwrapped first.
 */
export function html_to_markdown(html: string): string {
  if (!html || !html.trim())
    return ''

  const extensions = create_markdown_extensions()
  const json = generateJSON(unwrap_underline_inside_links(html), extensions)
  const editor = new Editor({ extensions, content: json })
  try {
    return get_editor_markdown(editor).trim()
  } finally {
    editor.destroy()
  }
}

function unwrap_underline_inside_links(html: string): string {
  if (!/<u[\s>]/i.test(html) || !/<a[\s>]/i.test(html))
    return html
  const host = document.createElement('div')
  host.innerHTML = html
  for (const underline of Array.from(host.querySelectorAll('a u'))) {
    while (underline.firstChild)
      underline.parentNode?.insertBefore(underline.firstChild, underline)
    underline.remove()
  }
  return host.innerHTML
}
