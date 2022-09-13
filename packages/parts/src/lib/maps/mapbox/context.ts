import type { Map, Marker } from 'mapbox-gl';

export type MapKeyContext = { getMap: () => Map; getMapbox: () => typeof import('mapbox-gl') };
export const mapKey = {};

export type MarkerKeyContext = { getMarker: () => Marker };
export const markerKey = {};

export type SourceKeyContext = {
  getSourceId: () => string;
  addChildLayer: (id: string) => void;
};
export const sourceKey = {};
