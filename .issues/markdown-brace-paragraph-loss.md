# Markdown: a paragraph that is entirely `{…}` vanishes at render

Found during the Phase-B cutover delta (2026-07-03), in freshly-edited
`boienen-old-buhi-langua.grammar`: the source HTML contained a standalone
notation-legend paragraph `<p>{grapheme}</p>`. `html_to_markdown` serializes it
as a bare `{grapheme}` line, and at render time **markdown-it-attrs' end-of-block
rule consumes any block whose content ends with `{…}`** — `allowedAttributes:
['class']` only filters what gets *applied*, the curly text is consumed
regardless. Result: the paragraph silently disappears from the rendered page.

Same bug exists LIVE in the editor path: type a paragraph consisting only of
`{word}` (or end any paragraph with `{…}`) in the markdown editor → saved fine,
but the reader view swallows it.

## Repro

```ts
render_markdown_to_html('/phoneme/\n\n{grapheme}\n\nCurly braces identify')
// → the {grapheme} paragraph is gone (plain markdown-it keeps it; the
//   configure_pandoc_spans attrs plugin eats it)
```

Inline braces mid-sentence (`such as {Xx}, when…`) are safe — only blocks
*ending* with `{…}` are at risk.

## Cutover handling (done)

The one affected value was patched at migration time: the standalone line was
stored as `\{grapheme\}` (markdown-escaped → renders as literal text; roundtrip
verified clean). Zero other values in the 47k-value corpus hit this class (the
Phase-A whole-corpus roundtrip audit would have flagged them).

## Proper fix (this issue)

Escape `{` in **plain-text serialization** so user-typed braces survive:
the clean point is the tiptap-markdown/prosemirror-markdown text serializer
(escape `{` → `\{` in text nodes only — NOT in the deliberately-emitted
`[…]{.underline}` / `[…]{.smallcaps}` span syntax and NOT inside raw-HTML
table blocks). Alternative: replace markdown-it-attrs with a stricter
class-only fork whose end-of-block rule requires `{.` — then bare `{word}`
never parses as attrs and nothing needs escaping (house uses the same
pandoc-spans setup — port the fix there too, `site/src/lib/markdown/`).

Verify with `markdown-roundtrip.test.ts` additions:
- paragraph of only `{word}` survives
- paragraph ending in `{…}` survives
- `[x]{.smallcaps}` still renders as a span
- editor byte-stability: converting/reloading stored content doesn't churn
