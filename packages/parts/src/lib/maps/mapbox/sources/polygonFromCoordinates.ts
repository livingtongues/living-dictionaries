export function polygonFromCoordinates(
  points: {
    lng: number;
    lat: number;
  }[]
): number[][][] {
  return [points.map(({ lng, lat }) => [lng, lat])];
}

if (import.meta.vitest) {
  test('polygonFromCoordinates', () => {
    expect(polygonFromCoordinates([{ lng: 0, lat: 0 }])).toMatchInlineSnapshot(`
      [
        [
          [
            0,
            0,
          ],
        ],
      ]
    `);
  });
}

