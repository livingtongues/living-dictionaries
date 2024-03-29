import type { IPoint, IRegion } from '@living-dictionaries/types';
import { sortPoints } from '../../utils/polygonFromCoordinates';
// http://geojson.io/ to create GeoJSON easily
import type { FeatureCollection, Feature, Polygon, Point } from 'geojson';

export function convertPointsIntoRegion(
  points: {
    longitude: number;
    latitude: number;
  }[]
) {
  const sorted = sortPoints(
    points.map(({ longitude, latitude }) => ({ lng: longitude, lat: latitude }))
  );
  const sortedLooped = [...sorted, sorted[0]];
  return sortedLooped.map(({ lng, lat }) => ({ longitude: lng, latitude: lat }));
}

function getPointFeature(point: IPoint, options = { primary: false }): Feature<Point> {
  const coordinates = [
    +point.coordinates.longitude.toFixed(3),
    +point.coordinates.latitude.toFixed(3),
  ];
  const properties = options.primary ? { 'marker-color': '#578da5', 'marker-symbol': 'star' } : {};
  return {
    type: 'Feature',
    properties,
    geometry: {
      type: 'Point',
      coordinates,
    },
  };
}

function getPolygonFeature(region: IRegion): Feature<Polygon> {
  const sorted = sortPoints(region.coordinates.map(({ longitude, latitude }) => ({ lng: longitude, lat: latitude })));
  const sortedLooped = [...sorted, sorted[0]];
  const coordinates = [
    sortedLooped.map(({ lng, lat }) => [
      +lng.toFixed(3),
      +lat.toFixed(3),
    ]),
  ];
  return {
    type: 'Feature',
    properties: {
      // stroke: '#555555',
      // 'stroke-width': 2
      // 'stroke-opacity': 1,
      // fill: '#ca2b2b',
      // 'fill-opacity': 0.5,
    },
    geometry: {
      type: 'Polygon',
      coordinates,
    },
  };
}

export function shapeGeoJson(points: IPoint[] = [], regions: IRegion[] = [], options = { primary: false }): FeatureCollection {
  const features: FeatureCollection['features'] = [];
  for (const region of regions)
    features.push(getPolygonFeature(region));

  // add points afterwards so pins show on top of regions
  for (const [index, point] of points.entries()) {
    const isFirstPoint = index === 0;
    features.push(getPointFeature(point, { primary: options.primary && isFirstPoint }));
  }
  return {
    type: 'FeatureCollection',
    features,
  };
}

if (import.meta.vitest) {
  const twoPoints = [
    { coordinates: { longitude: 126.123456789, latitude: 40.123456789 } },
    { coordinates: { longitude: 127.123456789, latitude: 41.123456789 } },
  ]

  describe(shapeGeoJson, () => {
    test('two simple points', () => {
      expect(shapeGeoJson(twoPoints)).toMatchInlineSnapshot(`
        {
          "features": [
            {
              "geometry": {
                "coordinates": [
                  126.123,
                  40.123,
                ],
                "type": "Point",
              },
              "properties": {},
              "type": "Feature",
            },
            {
              "geometry": {
                "coordinates": [
                  127.123,
                  41.123,
                ],
                "type": "Point",
              },
              "properties": {},
              "type": "Feature",
            },
          ],
          "type": "FeatureCollection",
        }
      `)
    });

    test('primary, secondary points and region', () => {
      expect(
        shapeGeoJson(
          twoPoints,
          [
            {
              coordinates: [
                { longitude: -126.91406249999999, latitude: 40.97989806962013 },
                { longitude: -118.828125, latitude: 36.03133177633187 },
                { longitude: -115.6640625, latitude: 38.8225909761771 },
                { longitude: -116.01562499999999, latitude: 42.8115217450979 },
              ],
            },
          ],
          { primary: true }
        )
      ).toMatchInlineSnapshot(`
        {
          "features": [
            {
              "geometry": {
                "coordinates": [
                  [
                    [
                      -118.828,
                      36.031,
                    ],
                    [
                      -126.914,
                      40.98,
                    ],
                    [
                      -116.016,
                      42.812,
                    ],
                    [
                      -115.664,
                      38.823,
                    ],
                    [
                      -118.828,
                      36.031,
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
                  126.123,
                  40.123,
                ],
                "type": "Point",
              },
              "properties": {
                "marker-color": "#578da5",
                "marker-symbol": "star",
              },
              "type": "Feature",
            },
            {
              "geometry": {
                "coordinates": [
                  127.123,
                  41.123,
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
  });
}
