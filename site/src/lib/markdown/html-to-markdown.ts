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
 * text-align + `<u>` are dropped by the extension set (see `create_markdown_extensions`).
 */
export function html_to_markdown(html: string): string {
  if (!html || !html.trim())
    return ''

  const extensions = create_markdown_extensions()
  const json = generateJSON(html, extensions)
  const editor = new Editor({ extensions, content: json })
  try {
    return get_editor_markdown(editor).trim()
  } finally {
    editor.destroy()
  }
}
