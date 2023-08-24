import type { Map, Marker } from 'mapbox-gl';

export interface MapKeyContext { getMap: () => Map; getMapbox: () => typeof import('mapbox-gl') }
export const mapKey = {};

export interface MarkerKeyContext { getMarker: () => Marker }
export const markerKey = {};

export interface SourceKeyContext {
  getSourceId: () => string;
  addChildLayer: (id: string) => void;
}
export const sourceKey = {};
