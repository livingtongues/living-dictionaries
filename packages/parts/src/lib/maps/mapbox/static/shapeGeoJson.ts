import type { IArea, IPoint, IRegion } from '@living-dictionaries/types';
// http://geojson.io/ to create GeoJSON easily

function getPointFeature(point: IPoint) {
  const coordinates = [point.coordinates.longitude, point.coordinates.latitude];
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Point',
      coordinates,
    },
  };
}

function getPolygonFeature(region: IRegion) {
  const coordinates = [region.coordinates.map(({ longitude, latitude }) => [longitude, latitude])];
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates,
    },
    properties: {},
  };
}

export function shapeGeoJson(areas: IArea[]) {
  const features = [];
  for (const area of areas) {
    if (area.type === 'region') {
      features.push(getPolygonFeature(area));
    }
  }
  for (const area of areas) {
    if (area.type === 'point') {
      features.push(getPointFeature(area)); // add later so pins show on top of regions
    }
  }
  return {
    type: 'FeatureCollection',
    features,
  };
}

if (import.meta.vitest) {
  test('shapeGeoJson', () => {
    expect(
      shapeGeoJson([
        { type: 'point', coordinates: { longitude: 126, latitude: 40 } },
        {
          type: 'region',
          coordinates: [
            { longitude: -126.91406249999999, latitude: 40.97989806962013 },
            { longitude: -118.828125, latitude: 36.03133177633187 },
            { longitude: -115.6640625, latitude: 38.8225909761771 },
            { longitude: -116.01562499999999, latitude: 42.8115217450979 },
            { longitude: -126.91406249999999, latitude: 40.97989806962013 },
          ],
        },
      ])
    ).toMatchInlineSnapshot(`
      {
        "features": [
          {
            "geometry": {
              "coordinates": [
                [
                  [
                    -126.91406249999999,
                    40.97989806962013,
                  ],
                  [
                    -118.828125,
                    36.03133177633187,
                  ],
                  [
                    -115.6640625,
                    38.8225909761771,
                  ],
                  [
                    -116.01562499999999,
                    42.8115217450979,
                  ],
                  [
                    -126.91406249999999,
                    40.97989806962013,
                  ],
                ],
              ],
              "type": "Polygon",
            },
            "properties": {},
            "type": "Feature",
          },
          {
            "geometry": {
              "coordinates": [
                126,
                40,
              ],
              "type": "Point",
            },
            "properties": {},
            "type": "Feature",
          },
        ],
        "type": "FeatureCollection",
      }
    `);
  });
}
