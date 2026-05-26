import type { Component, ComponentProps } from 'svelte'
import { render } from 'svelte/server'

/**
 * Renders a Svelte component to a full HTML document suitable for SES `Body.Html`.
 *
 * Why the cleanup dance:
 * - Svelte SSR emits sourcemap-y comments inside `<style>` blocks that some
 *   email clients render literally — strip them.
 * - Each `<style>` from a component lands as its own `<style>` tag in `head`.
 *   We unwrap each one's tag, concat the contents, and re-wrap as a single
 *   `<style type="text/css">` block injected just before `</head>`.
 * - Empty CSS rules (`* {}`, `.foo {}`) survive Svelte's scoping pass when a
 *   selector matches nothing in the rendered HTML — drop them to keep payload
 *   small and email-client friendly.
 * - Svelte SSR sprinkles HTML comment markers (`<!---->`, `<!--[-->`, etc.)
 *   to mark hydration boundaries. Strip them — emails don't hydrate.
 *
 * Ported from house/site/src/routes/api/email/render-component-to-html.ts.
 */
export function render_component_to_html<Comp extends Component<any>, Props extends ComponentProps<Comp> = ComponentProps<Comp>>({
  component,
  props,
}: {
  component: Comp
  props?: Props
}) {
  const rendered = render(component as any, { props })

  const css_sourcemaps = /\/\*.*\*\//g
  const style_tags = /<\/?style[^>]*>/g
  const empty_css_rules = /(\*|\.[\w-]+)\s*\{\s*\}/g

  const head_styles = rendered.head
    .replace(css_sourcemaps, '')
    .replace(style_tags, '')
  const style_block = `<style type="text/css">${head_styles}</style>`

  const doctype = '<!DOCTYPE html>'
  const document = `${doctype}${rendered.body
    .replace('</head>', `${style_block}</head>`)
    .replace(empty_css_rules, '')
    .replaceAll('<!---->', '')
    .replaceAll('<!--[-->', '')
    .replaceAll('<!--[!-->', '')
    .replaceAll('<!--]-->', '')
    .replace(/<!--[a-z0-9]{6}-->/gi, '')
    .replace(/<!--\[-?\d+-->/g, '')
  }`

  return document
}
