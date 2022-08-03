export function polygonFromCoordinates(
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
      polygonFromCoordinates([
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

interface Point {
  x: number;
  y: number;
}

function sortPoints(points: Point[]) {
  points = points.splice(0);
  const p0: Point = { x: 0, y: 0 };
  p0.y = Math.min.apply(
    null,
    points.map((p) => p.y)
  );
  p0.x = Math.max.apply(
    null,
    points.filter((p) => p.y == p0.y).map((p) => p.x)
  );
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
