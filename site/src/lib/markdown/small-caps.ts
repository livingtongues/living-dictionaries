import { Mark, mergeAttributes } from '@tiptap/core'
import { configure_pandoc_spans } from './markdown-it-pandoc-spans'

/**
 * Small-caps mark, ported from house. LD's legacy CKEditor build
 * (`…-with-alignment-underline-smallcaps`) had a small-caps button and the
 * 2026-07-02 cutover content audit found 50 real values using it (linguistic
 * convention for glosses/names, e.g. dogon.grammar, eyak.about). Markdown has
 * no native syntax, so it's stored as a Pandoc attribute span
 * `[text]{.smallcaps}` and rendered back to `<span class="smallcaps">`.
 *
 * - CKEditor emitted `<span style="font-variant:small-caps">` — `parseHTML`
 *   matches that (for the cutover conversion) AND our own `span.smallcaps`
 *   (round-trip).
 * - Markdown serialization (editor → markdown) via `storage.markdown.serialize`;
 *   the reverse (markdown → HTML) is the shared `configure_pandoc_spans`
 *   markdown-it plugin, registered here so the mark owns both directions.
 */
export const SmallCaps = Mark.create({
  name: 'smallCaps',

  parseHTML() {
    return [
      { tag: 'span.smallcaps' },
      {
        style: 'font-variant',
        getAttrs: value => (typeof value === 'string' && /small-caps/.test(value)) ? {} : false,
      },
      {
        style: 'font-variant-caps',
        getAttrs: value => (typeof value === 'string' && /small-caps/.test(value)) ? {} : false,
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'smallcaps' }), 0]
  },

  addStorage() {
    return {
      markdown: {
        serialize: { open: '[', close: ']{.smallcaps}', mixable: false, expelEnclosingWhitespace: true },
        parse: {
          setup(markdown_it: unknown) {
            configure_pandoc_spans(markdown_it)
          },
        },
      },
    }
  },
})
