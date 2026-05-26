import { describe, expect, test } from 'vitest'
import MessageReply from './components/MessageReply.svelte'
import NewUserWelcome from './components/NewUserWelcome.svelte'
import OtpEmail from './components/OtpEmail.svelte'
import { render_component_to_html } from './render-component-to-html'

describe(render_component_to_html, () => {
  test('renders OtpEmail with code + minutes', () => {
    const html = render_component_to_html({
      component: OtpEmail,
      props: { code: '482910', minutes: 30 },
    })

    expect(html.startsWith('<!DOCTYPE html>')).toBeTruthy()
    expect(html).toContain('482910')
    expect(html).toContain('30 minutes')
    expect(html).toContain('Your sign-in code')
    expect(html).toContain('Living Dictionaries')
    // Preheader for inbox preview
    expect(html).toContain('482910 is your sign-in code')
    // Email-safe table layout (not flex/grid)
    expect(html).toContain('<table')
    // Charset declaration
    expect(html).toContain('charset=utf-8')
    // Viewport meta for mobile clients
    expect(html).toContain('width=device-width')
  })

  test('singular minute when 1', () => {
    const html = render_component_to_html({
      component: OtpEmail,
      props: { code: '111111', minutes: 1 },
    })
    expect(html).toContain('1 minute')
    expect(html).not.toContain('1 minutes')
  })

  test('MessageReply wraps raw body_html via {@html}', () => {
    const body_html = '<p>Hi Alice, the feature is under Settings.</p>'
    const html = render_component_to_html({
      component: MessageReply,
      props: { body_html, preheader: 'Hi Alice, the feature is under...' },
    })

    expect(html).toContain('Hi Alice, the feature is under Settings.')
    // No system-email chrome
    expect(html).not.toContain('You\'re receiving this because someone')
    // Still has the email-safe scaffold
    expect(html).toContain('<table')
    expect(html).toContain('charset=utf-8')
  })

  test('NewUserWelcome renders with name', () => {
    const html = render_component_to_html({
      component: NewUserWelcome,
      props: { name: 'Alice' },
    })
    expect(html).toContain('Welcome, Alice!')
    expect(html).toContain('Living Dictionaries community')
    expect(html).toContain('diego@livingtongues.org')
    expect(html).toContain('livingdictionaries.app')
  })

  test('NewUserWelcome renders without name', () => {
    const html = render_component_to_html({
      component: NewUserWelcome,
      props: { name: null },
    })
    expect(html).toContain('Welcome!')
    expect(html).not.toContain('Welcome, ')
  })

  test('strips Svelte SSR comment markers', () => {
    const html = render_component_to_html({
      component: OtpEmail,
      props: { code: '000000', minutes: 30 },
    })
    expect(html).not.toContain('<!---->')
    expect(html).not.toContain('<!--[-->')
    expect(html).not.toContain('<!--]-->')
  })

  test('strips CSS sourcemap comments from injected styles', () => {
    const html = render_component_to_html({
      component: OtpEmail,
      props: { code: '000000', minutes: 30 },
    })
    expect(/<style[^>]*>[\s\S]*\/\*[\s\S]*?\*\/[\s\S]*<\/style>/.test(html)).toBeFalsy()
  })
})
