import type { Variants } from 'kitbook';
import type Component from './GeoTaggingModal.svelte';
import type { IRegion } from '@living-dictionaries/types';

const tw_region: IRegion = {coordinates: [
  {latitude: 23.2, longitude: 121},
  {latitude: 24, longitude: 121.1},
  {latitude: 23.4, longitude: 121.5},
  {latitude: 23.0, longitude: 121.3},
]}

export const variants: Variants<Component> = [
  {
    height: 600,
    props: {
      initialCenter: null,
      coordinates: {
        points: [
          {coordinates: {latitude: 23.2, longitude: 121.1}},
          {coordinates: {latitude: 23.6978, longitude: 120.9605}},
        ],
        regions: [
          tw_region,
        ],
      }
    }
  },
  {
    height: 600,
    props: {
      initialCenter: null,
      coordinates: {
        regions: [
          tw_region,
        ]
      },
    }
  },
  {
    height: 600,
    props: {
      initialCenter: null,
      coordinates: null,
    }
  },
]
