// from https://cs.stackexchange.com/questions/52606/sort-a-list-of-points-to-form-a-non-self-intersecting-polygon/52627
interface Point {
  lng: number;
  lat: number;
}

/** Will add loop back to first point so don't duplicate first point to last before sending points in, as the point ordering probably will change */
export function polygonFeatureCoordinates(
  points: { latitude?: number; longitude?: number }[]
): number[][][] {
  const sorted = sortPoints(
    points.map(({ latitude, longitude }) => ({ lng: longitude, lat: latitude }))
  );
  const sortedLooped = [...sorted, sorted[0]];
  return [sortedLooped.map(({ lng, lat }) => [lng, lat])];
}

export function sortPoints(points: Point[]) {
  points = points.splice(0);
  const p0: Point = { lng: 0, lat: 0 };
  p0.lat = Math.min(...points.map((p) => p.lat));
  p0.lng = Math.max(...points.filter((p) => p.lat == p0.lat).map((p) => p.lng));
  points.sort((a, b) => angleCompare(p0, a, b));
  return points;
}

function angleCompare(p0: Point, a: Point, b: Point) {
  const left = isLeft(p0, a, b);
  if (left == 0) return distCompare(p0, a, b);
  return left;
}

function isLeft(p0: Point, a: Point, b: Point) {
  return (a.lng - p0.lng) * (b.lat - p0.lat) - (b.lng - p0.lng) * (a.lat - p0.lat);
}

function distCompare(p0: Point, a: Point, b: Point) {
  const distA = (p0.lng - a.lng) * (p0.lng - a.lng) + (p0.lat - a.lat) * (p0.lat - a.lat);
  const distB = (p0.lng - b.lng) * (p0.lng - b.lng) + (p0.lat - b.lat) * (p0.lat - b.lat);
  return distA - distB;
}

if (import.meta.vitest) {
  describe(sortPoints, () => {
    test('basic', () => {
      const expected = [
        { lng: 1, lat: 0 },
        { lng: 0, lat: 0 },
        { lng: 0, lat: 1 },
        { lng: 1, lat: 1 },
      ]
      expect(
        sortPoints([
          { lng: 0, lat: 0 },
          { lng: 0, lat: 1 },
          { lng: 1, lat: 1 },
          { lng: 1, lat: 0 },
        ])
      ).toEqual(expected);

      expect(
        sortPoints([
          { lng: 0, lat: 0 },
          { lng: 1, lat: 0 },
          { lng: 1, lat: 1 },
          { lng: 0, lat: 1 },
        ])
      ).toEqual(expected);
    });

    test('more complicated', () => {
      const points = [
        { lng: -95, lat: 44 },
        { lng: -105, lat: 35 },
        { lng: -105, lat: 42 },
        { lng: -96, lat: 37 },
        { lng: -99.9115, lat: 34.4528 },
      ];
      expect(sortPoints(points)).toEqual([
        { lng: -99.9115, lat: 34.4528 },
        { lng: -105, lat: 35 },
        { lng: -105, lat: 42 },
        { lng: -95, lat: 44 },
        { lng: -96, lat: 37 },
      ]);
    });
  });
}
