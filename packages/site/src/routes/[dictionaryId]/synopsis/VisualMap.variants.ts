import type { Variant, VariantMeta } from 'kitbook'
import type Component from './VisualMap.svelte'

export const shared_meta: VariantMeta = {
  viewports: [
    { width: 600, height: 300 },
  ],
}

export const With_Coordinates: Variant<Component> = {
  coordinates: {
    points: [{ coordinates: { latitude: 49, longitude: 87 } }],
  },
}

export const Without_Coordinates: Variant<Component> = {
  coordinates: null,
}
