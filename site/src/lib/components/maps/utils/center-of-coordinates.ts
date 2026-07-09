/**
 * Bounding-box midpoint of a set of coordinates — local replacement for
 * `center(points(coords))` from @turf/center + @turf/helpers (yoinked 2026-07-02:
 * 3 deps / 9.1MB for two one-liner calls). Turf's `center` is the midpoint of the
 * bounding box, reproduced exactly here.
 */
export function center_of_coordinates(
  coordinates: { longitude?: number, latitude?: number }[],
): [lng: number, lat: number] {
  const lngs = coordinates.map(({ longitude }) => longitude)
  const lats = coordinates.map(({ latitude }) => latitude)
  return [
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ]
}

if (import.meta.vitest) {
  describe(center_of_coordinates, () => {
    test('square', () => {
      expect(
        center_of_coordinates([
          { longitude: 0, latitude: 0 },
          { longitude: 2, latitude: 0 },
          { longitude: 2, latitude: 2 },
          { longitude: 0, latitude: 2 },
        ]),
      ).toEqual([1, 1])
    })

    test('bbox midpoint, not centroid (matches @turf/center)', () => {
      // an off-center extra point changes a centroid but not the bbox midpoint
      expect(
        center_of_coordinates([
          { longitude: -10, latitude: 40 },
          { longitude: -10.5, latitude: 40.5 },
          { longitude: -12, latitude: 44 },
        ]),
      ).toEqual([-11, 42])
    })
  })
}
