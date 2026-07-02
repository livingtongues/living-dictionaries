import { Mark, mergeAttributes } from '@tiptap/core'
import { configure_pandoc_spans } from './markdown-it-pandoc-spans'

/**
 * Legacy-underline mark. The 2026-07-02 cutover audit found 1,039 rich-text
 * values using CKEditor's `<u>` — and a meaningful subset carries real
 * semantics that bold/italic can't replace (they're usually ALREADY combined
 * with it):
 *  - single-letter phoneme highlighting: `m<u>e</u>n` "the vowel in men"
 *    (iipay-aa pronunciations)
 *  - run-in headings/labels: `<strong><u>Sinónimos:</u></strong>`,
 *    `<u>Present Tense</u>` (grammar pages)
 *  - key-phrase emphasis (belarusian.about)
 * So instead of dropping it, conversion stores a Pandoc span
 * `[text]{.underline}` → `<span class="underline">`, styled as a DOTTED
 * underline (distinct from solid link underlines; swap the one CSS rule in
 * typography.css if a different treatment is chosen later — the data is
 * lossless). No toolbar button — new content can't create it; it exists so
 * legacy content round-trips.
 */
export const LegacyUnderline = Mark.create({
  name: 'legacyUnderline',

  parseHTML() {
    return [
      { tag: 'u' },
      { tag: 'span.underline' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'underline' }), 0]
  },

  addStorage() {
    return {
      markdown: {
        serialize: { open: '[', close: ']{.underline}', mixable: false, expelEnclosingWhitespace: true },
        parse: {
          setup(markdown_it: unknown) {
            configure_pandoc_spans(markdown_it)
          },
        },
      },
    }
  },
})
