// default-import + destructure: 'xss' is CJS — named imports break Vite dev SSR
// ("Named export 'getDefaultWhiteList' not found"). The default export IS the
// module.exports object (the filter fn with FilterXSS etc. attached) — the cast
// gives it the module-namespace type so svelte-check sees the properties.
import xss from 'xss'

const { FilterXSS, getDefaultWhiteList } = xss as unknown as typeof import('xss')

/**
 * Sanitizer for RENDERED rich-text markdown (about/grammar pages, entry
 * notes). Same `xss` defaults as everywhere else, plus `span[class]` so the
 * SmallCaps mark's `<span class="smallcaps">` survives (the pandoc-spans
 * renderer locks the markdown side to `class` only; this locks the HTML side
 * the same way). Use plain `sanitize` from 'xss' for anything that isn't the
 * markdown pipeline.
 */
const rich_text_filter = new FilterXSS({
  whiteList: {
    ...getDefaultWhiteList(),
    span: ['class'],
  },
})

export function sanitize_rich_text(html: string): string {
  return rich_text_filter.process(html)
}
