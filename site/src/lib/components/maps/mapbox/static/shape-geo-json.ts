import type { IPoint, IRegion } from '$lib/types'
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'
import { sort_points } from '../../utils/polygon-from-coordinates'
// http://geojson.io/ to create GeoJSON easily

export function convert_points_into_region(
  points: {
    longitude: number
    latitude: number
  }[],
) {
  const sorted = sort_points(
    points.map(({ longitude, latitude }) => ({ lng: longitude, lat: latitude })),
  )
  const sorted_looped = [...sorted, sorted[0]]
  return sorted_looped.map(({ lng, lat }) => ({ longitude: lng, latitude: lat }))
}

function get_point_feature({ point, primary = false }: { point: IPoint, primary?: boolean }): Feature<Point> {
  const coordinates = [
    +point.coordinates.longitude.toFixed(3),
    +point.coordinates.latitude.toFixed(3),
  ]
  const properties = primary ? { 'marker-color': '#578da5', 'marker-symbol': 'star' } : {}
  return {
    type: 'Feature',
    properties,
    geometry: {
      type: 'Point',
      coordinates,
    },
  }
}

function get_polygon_feature(region: IRegion): Feature<Polygon> {
  const sorted = sort_points(region.coordinates.map(({ longitude, latitude }) => ({ lng: longitude, lat: latitude })))
  const sorted_looped = [...sorted, sorted[0]]
  const coordinates = [
    sorted_looped.map(({ lng, lat }) => [
      +lng.toFixed(3),
      +lat.toFixed(3),
    ]),
  ]
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
  }
}

export function shape_geo_json({ points = [], regions = [], primary = false }: { points?: IPoint[], regions?: IRegion[], primary?: boolean }): FeatureCollection {
  const features: FeatureCollection['features'] = []
  for (const region of regions)
    features.push(get_polygon_feature(region))

  // add points afterwards so pins show on top of regions
  for (const [index, point] of points.entries()) {
    const is_first_point = index === 0
    features.push(get_point_feature({ point, primary: primary && is_first_point }))
  }
  return {
    type: 'FeatureCollection',
    features,
  }
}

if (import.meta.vitest) {
  const two_points = [
    { coordinates: { longitude: 126.123456789, latitude: 40.123456789 } },
    { coordinates: { longitude: 127.123456789, latitude: 41.123456789 } },
  ]

  describe(shape_geo_json, () => {
    test('two simple points', () => {
      expect(shape_geo_json({ points: two_points })).toMatchInlineSnapshot(`
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
    })

    test('primary, secondary points and region', () => {
      expect(
        shape_geo_json({
          points: two_points,
          regions: [
            {
              coordinates: [
                { longitude: -126.91406249999999, latitude: 40.97989806962013 },
                { longitude: -118.828125, latitude: 36.03133177633187 },
                { longitude: -115.6640625, latitude: 38.8225909761771 },
                { longitude: -116.01562499999999, latitude: 42.8115217450979 },
              ],
            },
          ],
          primary: true,
        }),
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
      `)
    })
  })
}
