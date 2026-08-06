import type { Story, StoryMeta } from 'svelte-look'
import type Component from './MarkdownEditor.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 720, height: 520 }],
  csr: true,
}

// A tiny solid-color PNG so the image node renders offline in the screenshot
// (markdown-it's link validator only allows png/jpeg/gif/webp data URIs).
const demo_image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUAAAACMCAYAAAANzXDRAAABf0lEQVR42u3UIQEAAAjAMCT1qUJBqIBnYgUuHlk9AB+FCIABAhgggAECGCCAAQIYIIABAhgggAECGCCAAQIYIIABAhgggAECGCCAAQIYIIABAhgggAECGCCAAQIYIIABAhgggAECGCBggEIABghggAAGCGCAAAYIYIAABghggAAGCGCAAAYIYIAABghggAAGCGCAAAYIYIAABghggAAGCGCAAAYIYIAABghggAAGCGCAgAECGCCAAQIYIIABAhgggAECGCCAAQIYIIABAhgggAECGCCAAQIYIIABAhgggAECGCCAAQIYIIABAhgggAECGCCAAQIYIGCAIgAGCGCAAAYIYIAABghggAAGCGCAAAYIYIAABghggAAGCGCAAAYIYIAABghggAAGCGCAAAYIYIAABghggAAGCGCAAAYIYICAAQoBGCCAAQIYIIABAhgggAECGCCAAQIYIIABAhgggAECGCCAAQIYIIABAhgggAECGCCAAQIYIIABAhggwM0ClTatcTmPKfcAAAAASUVORK5CYII='

const about = `## About this dictionary

The **Nahuatl** Living Dictionary documents the speech of the highland communities, gathered over field seasons with *elder speakers*.

- Recordings from three villages
- Reviewed by community managers

> Every word carries the voice of a speaker.

![](${demo_image})

See [the tutorials](https://livingdictionaries.app/tutorials) to contribute.`

export const Document: Story<typeof Component> = {
  props: { value: about },
}

export const NotesMinimal: Story<typeof Component> = {
  props: {
    value: 'Recorded near the river crossing; *uncertain tone* on the second syllable.',
    preset: 'minimal',
  },
}

export const Empty: Story<typeof Component> = {
  props: { value: '', placeholder: 'Write about this dictionary…' },
}

export const WithSimpleTable: Story<typeof Component> = {
  props: {
    value: `## Pronoun prefixes

| Person | Singular | Plural |
| --- | --- | --- |
| First | ni- | ti- |
| Second | ti- | an- |`,
  },
  interactions: async (page) => {
    await page.click('td')
  },
}

export const WithParadigmTable: Story<typeof Component> = {
  props: {
    value: `## Subject prefixes

<table><tbody><tr><th colspan="2"><p>Independent</p></th><th><p>Dependent</p></th></tr><tr><th><p>Person</p></th><th><p>Singular</p></th><th><p>Plural</p></th></tr><tr><th><p>First</p></th><td><p>ni-</p></td><td><p>ti-</p></td></tr><tr><th><p>Second</p></th><td><p>ti-</p></td><td><p>an-</p></td></tr></tbody></table>`,
  },
  interactions: async (page) => {
    await page.click('td')
  },
}

export const WithMinimalLegacyTable: Story<typeof Component> = {
  props: {
    preset: 'minimal',
    value: '<table><tbody><tr><td><p>Legacy note</p></td><td><p>Editable value</p></td></tr></tbody></table>',
  },
  interactions: async (page) => {
    await page.click('td')
  },
}
