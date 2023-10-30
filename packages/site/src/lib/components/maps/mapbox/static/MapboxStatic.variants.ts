import type { Variant, Viewport } from 'kitbook'
import type Component from './MapboxStatic.svelte'

export const viewports: Viewport[] = [
  { name: 'Mobile', width: 320, height: 320}
]

// export const languages = []

export const variants: Variant<Component>[] = [
  {
    name: 'India trapezoid region',
    props: {
      'points': [],
      'regions': [
        {
          'coordinates': [
            {
              'longitude': 76.53807812500065,
              'latitude': 25.598062849584352
            },
            {
              'longitude': 91.12792187500162,
              'latitude': 25.598062849584352
            },
            {
              'longitude': 82.60253125000094,
              'latitude': 30.93627270844425
            },
            {
              'latitude': 18.933437473181115,
              'longitude': 83.04198437500133
            }
          ]
        }
      ]
    },
  },
  {
    name: 'Invalid GeoJSON',
    props: {
      'points': [],
      'regions': [
        {
          'coordinates': [
            {
              'longitude': 76.53807812500065,
              'latitude': 25.598062849584352
            },
          ]
        }
      ]
    },
  },
]
