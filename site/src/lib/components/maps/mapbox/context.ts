import type { Map, Marker } from 'mapbox-gl'

export interface MapKeyContext { get_map: () => Map, get_mapbox: () => typeof import('mapbox-gl') }
export const map_key = {}

export interface MarkerKeyContext { get_marker: () => Marker }
export const marker_key = {}

export interface SourceKeyContext {
  get_source_id: () => string
  add_child_layer: (id: string) => void
}
export const source_key = {}
