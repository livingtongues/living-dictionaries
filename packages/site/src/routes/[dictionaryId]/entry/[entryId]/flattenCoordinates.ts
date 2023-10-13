import type { Coordinates } from '@living-dictionaries/types';

export function flattenCoordinates(coordinates: Coordinates): number[][] {
  const flattened = [];
  const points = coordinates?.points?.map(({coordinates}) => {
    return [coordinates.longitude, coordinates.latitude];
  });
  if (points) flattened.push(...points);

  const regions = coordinates?.regions?.map(({coordinates}) => {
    return coordinates.map(({longitude, latitude}) => {
      return [longitude, latitude];
    });
  });
  if (regions) flattened.push(...regions.flat(1));

  return flattened;
}

if (import.meta.vitest) {
  describe(flattenCoordinates, () => {
    test('returns an array of number tuples [lng, lat]', () => {
      const coordinates: Coordinates = {
        points: [
          {coordinates: {latitude: 23.2, longitude: 121.1}},
          {coordinates: {latitude: 23.6978, longitude: 120.9605}},
        ],
        regions: [
          {coordinates: [
            {latitude: 23.2, longitude: 121},
            {latitude: 24, longitude: 121.1},
            {latitude: 23.4, longitude: 121.5},
            {latitude: 23.0, longitude: 121.3},
          ]},
        ],
      }
      expect(flattenCoordinates(coordinates)).toEqual([
        [121.1, 23.2],
        [120.9605, 23.6978],
        [121, 23.2],
        [121.1, 24],
        [121.5, 23.4],
        [121.3, 23],
      ]);
    });

    test('returns empty if no coordinates are provided', () => {
      const coordinates: Coordinates = {
        points: [],
        regions: [],
      }
      expect(flattenCoordinates(coordinates)).toEqual([]);
    });

    test('handles no points', () => {
      const coordinates: Coordinates = {
        regions: [],
      }
      expect(flattenCoordinates(coordinates)).toEqual([]);
    });

    test('handles no regions', () => {
      const coordinates: Coordinates = {
        points: [],
      }
      expect(flattenCoordinates(coordinates)).toEqual([]);
    });

    test('handles null', () => {
      expect(flattenCoordinates(null)).toEqual([]);
    });
  });
}
