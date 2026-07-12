import type { Story, StoryMeta } from 'svelte-look'
import type Component from './HeadlessButton.svelte'
import { createRawSnippet } from 'svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 240, height: 70 }],
}

const label = (text: string) => createRawSnippet(() => ({ render: () => `<span>${text}</span>` }))

export const Primary: Story<typeof Component> = {
  props: { children: label('Save'), class: 'btn-primary btn-default' },
}

export const Neutral: Story<typeof Component> = {
  props: { children: label('Select region'), class: 'btn btn-default' },
}

export const Ghost: Story<typeof Component> = {
  props: { children: label('Cancel'), class: 'btn-ghost btn-default' },
}

export const GhostDangerSmall: Story<typeof Component> = {
  props: { children: label('Delete'), class: 'btn-ghost btn-sm', style: 'color: var(--danger)' },
}

export const Loading: Story<typeof Component> = {
  props: { children: label('Uploading'), class: 'btn-primary btn-default', loading: true },
}

export const LinkExternal: Story<typeof Component> = {
  props: { children: label('Docs'), class: 'btn btn-default', href: 'https://example.com', target: '_blank', showExternalLinkIcon: true },
}
