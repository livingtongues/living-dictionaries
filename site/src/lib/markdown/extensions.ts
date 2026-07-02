import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Markdown } from 'tiptap-markdown'
import type { Extensions } from '@tiptap/core'

/**
 * The ONE Tiptap extension set that defines the rich-text content model
 * (dictionary `about` / `grammar`, entry `notes`) — shared by the live editor,
 * the HTML→markdown converter, and (at cutover) the Supabase migration, so
 * every path round-trips identically. Ported from house's library extensions.
 *
 * Deliberate omissions (matching house + the ckeditor-to-tiptap decision):
 *  - No `TextAlign` → `text-align` styles on legacy HTML are silently dropped.
 *  - `underline: false` → legacy `<u>` unwraps to plain text.
 *  - No SmallCaps / Table yet — the cutover content audit decides whether real
 *    content needs them (extend HERE if so; the converter uses this same set).
 *
 * Headings capped at 1–3. Image is a standalone node (StarterKit doesn't
 * bundle it) — LD images are stable lh3/GCS URLs, so plain `![](url)`.
 */
export function create_markdown_extensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      underline: false,
    }),
    // allowBase64 so legacy pasted-in-CKEditor base64 images survive conversion
    // (markdown-it's link validator still limits data URIs to png/jpeg/gif/webp).
    Image.configure({ allowBase64: true }),
    // `html: true` so any long tail markdown can't express round-trips
    // losslessly. Rendered output is still passed through `sanitize()` at
    // every display site — LD content is manager-authored by external users.
    Markdown.configure({ html: true, transformPastedText: true, transformCopiedText: true, breaks: false }),
  ]
}

/** Read the serialized markdown out of a Tiptap editor built with the set above. */
export function get_editor_markdown(editor: unknown): string {
  const { storage } = editor as { storage: { markdown?: { getMarkdown: () => string } } }
  return storage.markdown?.getMarkdown() ?? ''
}
