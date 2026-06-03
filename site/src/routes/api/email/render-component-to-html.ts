import type { ComponentProps, ComponentType, SvelteComponent } from 'svelte'
// import pretty from 'pretty'

export function render_component_to_html<Component extends SvelteComponent>({
  component,
  props,
  // options,
}: {
  component: ComponentType<Component>
  props?: ComponentProps<Component>
  // options?: {
  //   pretty?: boolean
  // }
}) {
  const doctype = '<!DOCTYPE html>'
  const { html, css } = (component as any).render(props) as { html: string, css: { code: string } }
  const style_block = `<style type="text/css">${css.code}</style>`
  const document = `${doctype}${html
    .replace('</head>', `${style_block}</head>`)
    .replaceAll('<!-- HTML_TAG_START -->', '')
    .replaceAll('<!-- HTML_TAG_END -->', '')
    .replace(/(\*|\.[\w-]+)\s*\{\s*\}/g, '')
  }`
  // if (options?.pretty)
  //   return pretty(document, { ocd: true })

  return document
}
