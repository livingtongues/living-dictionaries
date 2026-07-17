import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from 'tiptap-markdown'
import type { Extensions } from '@tiptap/core'
import { clean_table_markup } from './clean-tables'
import { LegacyUnderline } from './legacy-underline'
import { SmallCaps } from './small-caps'

/**
 * The ONE Tiptap extension set that defines the rich-text content model
 * (dictionary `about` / `grammar`, entry `notes`) — shared by the live editor,
 * the HTML→markdown converter, and (at cutover) the legacy-content migration, so
 * every path round-trips identically. Ported from house's library extensions.
 *
 * Deliberate omissions (matching house + the ckeditor-to-tiptap decision,
 * confirmed by the 2026-07-02 cutover content audit):
 *  - No `TextAlign` → `text-align` styles on legacy HTML are silently dropped
 *    (646 legacy values affected — layout only, text survives).
 *  - `underline: false` in StarterKit — but legacy `<u>` (1,039 values) is NOT
 *    dropped: it converts to the lossless `[…]{.underline}` span (see
 *    legacy-underline.ts; audit found real semantics — phoneme letters,
 *    run-in headings).
 * Audit-driven additions (2026-07-02, Jacob-approved):
 *  - SmallCaps (50 real values — Pandoc span `[…]{.smallcaps}`, small-caps.ts)
 *  - TableKit (317 values with real tables, mostly grammar paradigms) — tables
 *    serialize as raw HTML blocks inside markdown (`html: true` long-tail path,
 *    house's model; `clean_table_markup` strips Tiptap's layout cruft).
 *    Converting them to REAL markdown tables is a wished-for future session
 *    (see .issues/future/markdown-tables.md) — GFM can't express the
 *    colspan/rowspan some linguistic paradigms use, so it needs eyeballing.
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
    SmallCaps,
    LegacyUnderline,
    TableKit.configure({ table: { resizable: false } }),
    // `html: true` so any long tail markdown can't express round-trips
    // losslessly. Rendered output is still passed through `sanitize()` at
    // every display site — LD content is manager-authored by external users.
    Markdown.configure({ html: true, transformPastedText: true, transformCopiedText: true, breaks: false }),
  ]
}

/**
 * Read the serialized markdown out of a Tiptap editor built with the set above.
 * Tables serialize as raw HTML (the `html: true` long-tail path);
 * `clean_table_markup` strips Tiptap's injected layout noise.
 */
export function get_editor_markdown(editor: unknown): string {
  const { storage } = editor as { storage: { markdown?: { getMarkdown: () => string } } }
  return clean_table_markup(storage.markdown?.getMarkdown() ?? '')
}
