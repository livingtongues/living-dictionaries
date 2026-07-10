import { describe, expect, test } from 'vitest'
import RenderFixtureEmail from './render-component-to-html.fixture.svelte'
import { render_component_to_html } from './render-component-to-html'

describe(render_component_to_html, () => {
  test('renders an email component to a full HTML document', () => {
    const html = render_component_to_html({ component: RenderFixtureEmail })

    expect(html.startsWith('<!DOCTYPE html>')).toBeTruthy()
    expect(html).toContain('Fixture Heading')
    expect(html).toContain('Fixture body paragraph for the renderer test.')
    expect(html).toContain('Fixture Button')
    // Email-safe table layout (not flex/grid)
    expect(html).toContain('<table')
    // Charset + mobile viewport metas survive
    expect(html).toContain('charset=utf-8')
    expect(html).toContain('width=device-width')
  })

  test('strips Svelte SSR hydration comment markers', () => {
    const html = render_component_to_html({ component: RenderFixtureEmail })
    expect(html).not.toContain('<!---->')
    expect(html).not.toContain('<!--[-->')
    expect(html).not.toContain('<!--]-->')
  })
})
