import bracketed_spans from 'markdown-it-bracketed-spans'
import attrs from 'markdown-it-attrs'

/**
 * Teach a markdown-it instance the Pandoc attribute-span syntax we use for the
 * marks markdown can't express — today `[text]{.smallcaps}` → `<span
 * class="smallcaps">text</span>`. `bracketed-spans` turns `[…]{…}` into a span;
 * `attrs` (restricted to `class` only) attaches the class. Locked to `class` so
 * content can't inject arbitrary attributes/ids/styles. (Ported verbatim from
 * house `site/src/lib/markdown/markdown-it-pandoc-spans.ts`.)
 *
 * Idempotent — the SmallCaps mark's `parse.setup` calls this, and the reader
 * renderer builds from the same helper, so editor-parse and reader-render stay
 * byte-identical.
 */
export function configure_pandoc_spans(markdown_it: unknown): void {
  const md = markdown_it as { __pandoc_spans__?: boolean, use: (plugin: unknown, opts?: unknown) => unknown }
  if (md.__pandoc_spans__)
    return
  md.__pandoc_spans__ = true
  md.use(bracketed_spans)
  md.use(attrs, { allowedAttributes: ['class'] })
}
