import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Badge.svelte'
import { createRawSnippet } from 'svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 340, height: 60 }],
}

const label = (text: string) => createRawSnippet(() => ({ render: () => `<span>${text}</span>` }))

export const Default: Story<typeof Component> = {
  props: { children: label('Semantic domain') },
}

export const Removable: Story<typeof Component> = {
  props: { children: label('Removable'), onx: () => {} },
}

export const ColorsWithX: Story<typeof Component> = {
  viewports: [{ width: 340, height: 160 }],
  props: { children: label('red'), color: 'red', onx: () => {} },
}

export const ExternalLink: Story<typeof Component> = {
  props: { children: label('livingtongues.org'), href: 'https://livingtongues.org', target: '_blank' },
}

export const Green: Story<typeof Component> = {
  props: { children: label('green'), color: 'green', onx: () => {} },
}

export const Orange: Story<typeof Component> = {
  props: { children: label('orange'), color: 'orange', onx: () => {} },
}

export const Gray: Story<typeof Component> = {
  props: { children: label('gray'), color: 'gray', onx: () => {} },
}
