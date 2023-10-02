import type { Variants } from 'kitbook';
import type Component from './GeoTaggingModal.svelte';
import type { IRegion } from '@living-dictionaries/types';

const tw_region: IRegion = {coordinates: [
  {latitude: 23.2, longitude: 121},
  {latitude: 24, longitude: 121.1},
  {latitude: 23.4, longitude: 121.5},
  {latitude: 23.0, longitude: 121.3},
]}
const bangladesh = {latitude: 23.2, longitude: 90}

export const variants: Variants<Component> = [
  {
    name: 'points and region',
    props: {
      initialCenter: bangladesh,
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
    name: 'region only',
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
    name: 'no points, initial dictionary center',
    props: {
      initialCenter: bangladesh,
      coordinates: null,
    }
  },
  {
    name: 'nothing',
    props: {
      initialCenter: null,
      coordinates: null,
    }
  },
]
