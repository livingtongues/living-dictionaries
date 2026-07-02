/**
 * Bounding box of [lng, lat] positions as [minLng, minLat, maxLng, maxLat] —
 * local replacement for `bbox(lineString(positions))` from @turf/turf
 * (yoinked 2026-07-02 along with centerOfCoordinates).
 */
export function bboxOfCoordinates(
  positions: number[][],
): [minLng: number, minLat: number, maxLng: number, maxLat: number] {
  const lngs = positions.map(([lng]) => lng)
  const lats = positions.map(([, lat]) => lat)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

if (import.meta.vitest) {
  describe(bboxOfCoordinates, () => {
    test('matches turf bbox(lineString(...)) shape', () => {
      expect(
        bboxOfCoordinates([
          [-105, 35],
          [-95, 44],
          [-99.9115, 34.4528],
        ]),
      ).toEqual([-105, 34.4528, -95, 44])
    })
  })
}
