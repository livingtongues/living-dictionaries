import type { Component, ComponentProps } from 'svelte'
// import pretty from 'pretty'
import { render } from 'svelte/server'

export function render_component_to_html<Comp extends Component<any>, Props extends ComponentProps<Comp> = ComponentProps<Comp>>({
  component,
  props,
  // tidy = false,
}: {
  component: Comp
  props?: Props
  // tidy?: boolean
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
  }`
  // if (tidy)
  //   return pretty(document, { ocd: true })

  return document
}
