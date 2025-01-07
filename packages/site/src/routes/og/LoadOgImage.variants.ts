import type { Variant, VariantMeta } from 'kitbook'
import type Component from './LoadOgImage.svelte'

export const shared_meta: VariantMeta = {
  viewports: [
    { width: 370, height: 175 },
    { width: 600, height: 300 },
  ],
  csr: false,
}

const shared = {
  width: 1200,
  height: 600,
  dictionaryName: 'Fuliolo',
  lat: 10,
  lng: 35,
} satisfies Partial<Variant<Component>>

export const Image: Variant<Component> = {
  ...shared,
  title: 'húdié 蝴蝶 עִבְרִית',
  description: 'butterfly',
  gcsPath: 'LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g',
}

export const Long_Title: Variant<Component> = {
  ...shared,
  title: 'This is an example where the lexeme is an entire sentence!',
  description: 'So you can see how the font got a little bit smaller to allow for larger entries. This one also has USA coordinates.',
  lng: -95,
  lat: 40,
}

export const Long_Desc: Variant<Component> = {
  ...shared,
  title: 'Long description',
  description: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industrys standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.',
}
