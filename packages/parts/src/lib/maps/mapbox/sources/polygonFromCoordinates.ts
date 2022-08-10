// from https://cs.stackexchange.com/questions/52606/sort-a-list-of-points-to-form-a-non-self-intersecting-polygon/52627
export function nonSelfIntersectingPolygonFromCoordinates(
  points: {
    lng: number;
    lat: number;
  }[]
): number[][][] {
  const sortedPoints = sortPoints(points.map((p) => ({ x: p.lng, y: p.lat })));
  return [sortedPoints.map(({ x, y }) => [x, y])];
}

if (import.meta.vitest) {
  test('polygonFromCoordinates', () => {
    expect(
      nonSelfIntersectingPolygonFromCoordinates([
        { lng: 0, lat: 1 },
        { lng: 1, lat: 0 },
        { lng: 0, lat: 0 },
        { lng: 1, lat: 1 },
      ])
    ).toMatchInlineSnapshot(`
      [
        [
          [
            1,
            0,
          ],
          [
            0,
            0,
          ],
          [
            0,
            1,
          ],
          [
            1,
            1,
          ],
        ],
      ]
    `);
  });
}

if (import.meta.vitest) {
  test('Deeper polygonFromCoordinates test', () => {
    expect(
      nonSelfIntersectingPolygonFromCoordinates([
        {
          lng: -95,
          lat: 44,
        },
        {
          lng: -105,
          lat: 35,
        },
        {
          lng: -105,
          lat: 42,
        },
        {
          lng: -96,
          lat: 37,
        },
        {
          lng: -99.91155986691973,
          lat: 34.45282591700905,
        },
      ])
    ).toMatchInlineSnapshot(`
      [
        [
          [
            -99.91155986691973,
            34.45282591700905,
          ],
          [
            -105,
            35,
          ],
          [
            -105,
            42,
          ],
          [
            -95,
            44,
          ],
          [
            -96,
            37,
          ],
        ],
      ]
    `);
    expect(
      nonSelfIntersectingPolygonFromCoordinates([
        {
          lng: -95,
          lat: 44,
        },
        {
          lng: -105,
          lat: 35,
        },
        {
          lng: -105,
          lat: 42,
        },
        {
          lng: -96,
          lat: 37,
        },
        {
          lng: -100.5332443118098,
          lat: 36.26045081995481,
        },
      ])
    ).toMatchInlineSnapshot(`
      [
        [
          [
            -105,
            35,
          ],
          [
            -105,
            42,
          ],
          [
            -95,
            44,
          ],
          [
            -100.5332443118098,
            36.26045081995481,
          ],
          [
            -96,
            37,
          ],
        ],
      ]
    `);
  });
}

interface Point {
  x: number;
  y: number;
}

function sortPoints(points: Point[]) {
  points = points.splice(0);
  const p0: Point = { x: 0, y: 0 };
  p0.y = Math.min(...points.map((p) => p.y));
  p0.x = Math.max(...points.filter((p) => p.y == p0.y).map((p) => p.x));
  points.sort((a, b) => angleCompare(p0, a, b));
  return points;
}

function angleCompare(p0: Point, a: Point, b: Point) {
  const left = isLeft(p0, a, b);
  if (left == 0) return distCompare(p0, a, b);
  return left;
}

function isLeft(p0: Point, a: Point, b: Point) {
  return (a.x - p0.x) * (b.y - p0.y) - (b.x - p0.x) * (a.y - p0.y);
}

function distCompare(p0: Point, a: Point, b: Point) {
  const distA = (p0.x - a.x) * (p0.x - a.x) + (p0.y - a.y) * (p0.y - a.y);
  const distB = (p0.x - b.x) * (p0.x - b.x) + (p0.y - b.y) * (p0.y - b.y);
  return distA - distB;
}

if (import.meta.vitest) {
  test('sortPoints', () => {
    expect(
      sortPoints([
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 0 },
      ])
    ).toMatchInlineSnapshot(`
      [
        {
          "x": 1,
          "y": 0,
        },
        {
          "x": 0,
          "y": 0,
        },
        {
          "x": 0,
          "y": 1,
        },
        {
          "x": 1,
          "y": 1,
        },
      ]
    `);
    expect(
      sortPoints([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ])
    ).toMatchInlineSnapshot(`
      [
        {
          "x": 1,
          "y": 0,
        },
        {
          "x": 0,
          "y": 0,
        },
        {
          "x": 0,
          "y": 1,
        },
        {
          "x": 1,
          "y": 1,
        },
      ]
    `);
  });
}
