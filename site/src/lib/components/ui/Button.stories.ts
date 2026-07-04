import type { Story, StoryMeta } from 'svelte-look'
import { createRawSnippet } from 'svelte'
import type Component from './Button.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 260, height: 90 }],
}

/** A plain-text button label (Button takes its content via the `children` snippet). */
function label(text: string) {
  return createRawSnippet(() => ({ render: () => `<span>${text}</span>` }))
}

// --- forms (default color=primary, size=md) ---
export const OutlinePrimary: Story<typeof Component> = { props: { form: 'outline', color: 'primary', children: label('Outline') } }
export const FilledPrimary: Story<typeof Component> = { props: { form: 'filled', color: 'primary', children: label('Filled') } }
export const Menu: Story<typeof Component> = { props: { form: 'menu', color: 'black', children: label('Menu item') } }
export const Link: Story<typeof Component> = { props: { form: 'link', color: 'primary', children: label('Link') } }
export const Text: Story<typeof Component> = { props: { form: 'text', color: 'black', children: label('Text') } }

// --- filled colors ---
export const FilledRed: Story<typeof Component> = { props: { form: 'filled', color: 'red', children: label('Delete') } }
export const FilledOrange: Story<typeof Component> = { props: { form: 'filled', color: 'orange', children: label('Warn') } }
export const FilledGreen: Story<typeof Component> = { props: { form: 'filled', color: 'green', children: label('Save') } }
export const FilledBlack: Story<typeof Component> = { props: { form: 'filled', color: 'black', children: label('Black') } }
export const FilledWhite: Story<typeof Component> = { props: { form: 'filled', color: 'white', children: label('White') } }

// --- outline colors ---
export const OutlineRed: Story<typeof Component> = { props: { form: 'outline', color: 'red', children: label('Outline red') } }
export const OutlineGreen: Story<typeof Component> = { props: { form: 'outline', color: 'green', children: label('Outline green') } }

// --- sizes ---
export const Small: Story<typeof Component> = { props: { form: 'filled', color: 'primary', size: 'sm', children: label('Small') } }
export const Large: Story<typeof Component> = { props: { form: 'filled', color: 'primary', size: 'lg', children: label('Large') } }

// --- states ---
export const Disabled: Story<typeof Component> = { props: { form: 'filled', color: 'primary', disabled: true, children: label('Disabled') } }
export const Active: Story<typeof Component> = { props: { form: 'menu', color: 'black', active: true, children: label('Active') } }
export const Loading: Story<typeof Component> = { props: { form: 'filled', color: 'primary', loading: true, children: label('Loading') } }
export const ExternalLink: Story<typeof Component> = { props: { href: 'https://example.com', target: '_blank', form: 'outline', color: 'primary', showExternalLinkIcon: true, children: label('External') } }
