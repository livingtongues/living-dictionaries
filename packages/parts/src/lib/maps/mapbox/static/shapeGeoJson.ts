import type { IArea, IPoint, IRegion } from '@living-dictionaries/types';
import { sortPoints } from '../../utils/polygonFromCoordinates';
// http://geojson.io/ to create GeoJSON easily

export function convertPointsIntoRegion(
  points: {
    lng: number;
    lat: number;
  }[]
) {
  const sortedPoints = sortPoints(points.map((p) => ({ x: p.lng, y: p.lat })));

  const pointsWithFirstAddedToEnd = [...sortedPoints, sortedPoints[0]];
  return pointsWithFirstAddedToEnd.map((p) => {
    return { longitude: p.x, latitude: p.y };
  });
}

function getPointFeature(point: IPoint, primary = false) {
  const coordinates = [
    +point.coordinates.longitude.toFixed(3),
    +point.coordinates.latitude.toFixed(3),
  ];
  const properties = primary ? { 'marker-color': '#578da5', 'marker-symbol': 'star' } : {};
  return {
    type: 'Feature',
    properties,
    geometry: {
      type: 'Point',
      coordinates,
    },
  };
}

function getPolygonFeature(region: IRegion) {
  const coordinates = [
    region.coordinates.map(({ longitude, latitude }) => [
      +longitude.toFixed(3),
      +latitude.toFixed(3),
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

export function shapeGeoJson(areas: IArea[]) {
  const features = [];
  for (const area of areas) {
    if (area.type === 'region') {
      features.push(getPolygonFeature(area));
    }
  }
  for (const [index, area] of areas.entries()) {
    const primary = index === 0;
    if (area.type === 'point') {
      features.push(getPointFeature(area, primary)); // add later so pins show on top of regions
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
        { type: 'point', coordinates: { longitude: 126.123456789, latitude: 40.123456789 } },
        { type: 'point', coordinates: { longitude: 127.123456789, latitude: 41.123456789 } },
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
                    -126.914,
                    40.98,
                  ],
                  [
                    -118.828,
                    36.031,
                  ],
                  [
                    -115.664,
                    38.823,
                  ],
                  [
                    -116.016,
                    42.812,
                  ],
                  [
                    -126.914,
                    40.98,
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
}
