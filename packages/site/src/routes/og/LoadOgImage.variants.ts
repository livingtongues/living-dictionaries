import type { Variant, Viewport } from 'kitbook'
import type Component from './LoadOgImage.svelte'
import type { ComponentProps } from 'svelte'

export const viewports: Viewport[] = [
  { width: 300, height: 150 },
  { width: 600, height: 300 },
]

const default_props: Pick<ComponentProps<Component>, 'width' | 'height' | 'dictionaryName'> = {
  width: 1200,
  height: 600,
  dictionaryName: 'Fuliolo',
}

export const variants: Variant<Component>[] = [
  {
    name: 'image',
    props: {
      ...default_props,
      title: 'húdié 蝴蝶 עִבְרִית',
      description: 'butterfly',
      lat: 10,
      lng: 35,
      gcsPath: 'LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g',
    },
  },
  {
    name: 'no image',
    props: {
      ...default_props,
      title: 'This is an example where the lexeme is an entire sentence!',
      description:
        'So you can see how the font got a little bit smaller to allow for larger entries. This one also has USA coordinates.',
      lng: -95,
      lat: 40,
    },
  },
  {
    name: 'long description',
    props: {
      ...default_props,
      title: 'Long description',
      lat: 10,
      lng: 35,
      description:
        'Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industrys standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.',
    },
  },

]
