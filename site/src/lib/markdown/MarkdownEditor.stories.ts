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
