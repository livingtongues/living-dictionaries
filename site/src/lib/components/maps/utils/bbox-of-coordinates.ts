/**
 * Bounding box of [lng, lat] positions as [min_lng, min_lat, max_lng, max_lat] —
 * local replacement for `bbox(lineString(positions))` from @turf/turf
 * (yoinked 2026-07-02 along with center_of_coordinates).
 */
export function bbox_of_coordinates(
  positions: number[][],
): [min_lng: number, min_lat: number, max_lng: number, max_lat: number] {
  const lngs = positions.map(([lng]) => lng)
  const lats = positions.map(([, lat]) => lat)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

if (import.meta.vitest) {
  describe(bbox_of_coordinates, () => {
    test('matches turf bbox(lineString(...)) shape', () => {
      expect(
        bbox_of_coordinates([
          [-105, 35],
          [-95, 44],
          [-99.9115, 34.4528],
        ]),
      ).toEqual([-105, 34.4528, -95, 44])
    })
  })
}
