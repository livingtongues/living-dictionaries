import type { Tables } from '@living-dictionaries/types'
import type { GeoJSONSourceOptions } from 'mapbox-gl'

// leaving for reference
// const startCoordinates: {
//   [city: string]: [number, number];
// } = {
//   DC: [-77.04, 38.907],
//   USA: [-95, 38.907],
//   Japan: [135.753847, 34.986406],
//   CentralAmerica: [-80, 5],
// };

export function dictionaryGeoJsonCollection(dictionaries: Tables<'dictionaries_view'>[]): GeoJSONSourceOptions['data'] {
  return {
    type: 'FeatureCollection',
    features: dictionaries
      .filter(dict => dict.coordinates?.points?.length)
      .map((dict) => {
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [dict.coordinates.points[0].coordinates.longitude, dict.coordinates.points[0].coordinates.latitude],
          },
          properties: {
            name: dict.name,
            id: dict.id,
            // icon: dict.public ? 'logo' : 'library-15', // only new Living Dictionaries have public attribute
            // thumbnail: dict.thumbnail,
          },
        }
      }),
  }
}
