import type { IDictionary } from '$lib/interfaces';

export interface IGeometry {
  type: string;
  coordinates: number[];
}

export interface IGeoJson {
  type: string;
  geometry: IGeometry;
  properties?: any;
  $key?: string;
}

export class GeoJson implements IGeoJson {
  type = 'Feature';
  geometry: IGeometry;

  constructor(coordinates, public properties?) {
    this.geometry = {
      type: 'Point',
      coordinates: coordinates,
    };
  }
}

export class FeatureCollection {
  type = 'FeatureCollection';
  constructor(public features: Array<GeoJson>) {}
}

export const startCoordinates = {
  DC: [-77.04, 38.907],
  USA: [-95, 38.907],
  Japan: [135.753847, 34.986406],
  CentralAmerica: [-80, 5],
};

export class DictionaryGeoJsonCollection {
  type = 'FeatureCollection';
  features = [];
  constructor(dictionaries: Array<IDictionary>) {
    dictionaries.forEach((dictionary) => {
      if (dictionary.coordinates) {
        const feature: IGeoJson = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [dictionary.coordinates.longitude, dictionary.coordinates.latitude],
          },
          properties: {
            name: dictionary.name,
            id: dictionary.id,
            // icon: dictionary.public ? 'logo' : 'library-15', // only new Living Dictionaries have public attribute
            // thumbnail: dictionary.thumbnail,
          },
        };
        this.features.push(feature);
      }
    });
  }
}
