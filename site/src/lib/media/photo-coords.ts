/**
 * Village-level blunting for photo EXIF GPS: round to 2 decimals (~1.1 km at the
 * equator) ON INGEST — house-level precision must never reach the DB, backups,
 * or R2. The ~1 km grid cell IS the privacy envelope (no jitter needed).
 */
export function blunt_coordinate(value: number): number {
  return Math.round(value * 100) / 100
}

export interface PhotoExif {
  latitude?: number
  longitude?: number
  taken_at?: string
}

/** Validate + blunt raw EXIF-derived values into storable photo EXIF fields. */
export function normalize_photo_exif({ latitude, longitude, taken_at }: {
  latitude?: number | null
  longitude?: number | null
  taken_at?: Date | string | null
}): PhotoExif {
  const exif: PhotoExif = {}
  const valid_coords = typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180
    && !(latitude === 0 && longitude === 0) // null island = camera wrote empty GPS
  if (valid_coords) {
    exif.latitude = blunt_coordinate(latitude)
    exif.longitude = blunt_coordinate(longitude)
  }
  if (taken_at) {
    const date = taken_at instanceof Date ? taken_at : new Date(taken_at)
    if (!Number.isNaN(date.getTime()) && date.getFullYear() >= 1990 && date.getTime() <= Date.now() + 86_400_000)
      exif.taken_at = date.toISOString()
  }
  return exif
}

if (import.meta.vitest) {
  test(blunt_coordinate, () => {
    expect(blunt_coordinate(19.318472)).toBe(19.32)
    expect(blunt_coordinate(-98.23751)).toBe(-98.24)
    expect(blunt_coordinate(0.004)).toBe(0)
  })

  test(normalize_photo_exif, () => {
    expect(normalize_photo_exif({ latitude: 19.318472, longitude: -98.23751, taken_at: '2023-05-01T10:00:00Z' }))
      .toEqual({ latitude: 19.32, longitude: -98.24, taken_at: '2023-05-01T10:00:00.000Z' })
    expect(normalize_photo_exif({ latitude: 0, longitude: 0 })).toEqual({})
    expect(normalize_photo_exif({ latitude: 91, longitude: 10 })).toEqual({})
    expect(normalize_photo_exif({ latitude: null, longitude: null, taken_at: 'not a date' })).toEqual({})
    expect(normalize_photo_exif({ taken_at: '1970-01-01T00:00:00Z' })).toEqual({}) // camera epoch default
    expect(normalize_photo_exif({ latitude: 15.1, longitude: 120.55 })).toEqual({ latitude: 15.1, longitude: 120.55 })
  })
}
