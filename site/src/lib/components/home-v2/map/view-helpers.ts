/** Pure geometry/layout helpers for the homepage canvas map. */

export interface ScreenPoint<T> {
  x: number
  y: number
  item: T
}

export interface Cluster<T> {
  x: number
  y: number
  count: number
  items: T[]
}

/**
 * Grid-bin clustering in screen space. Points sharing a `bin_size` cell merge
 * into one cluster positioned at the members' centroid.
 */
export function cluster_points<T>({ points, bin_size }: { points: ScreenPoint<T>[], bin_size: number }): Cluster<T>[] {
  const bins = new Map<string, Cluster<T>>()
  for (const point of points) {
    const key = `${Math.round(point.x / bin_size)}:${Math.round(point.y / bin_size)}`
    const existing = bins.get(key)
    if (existing) {
      existing.x = (existing.x * existing.count + point.x) / (existing.count + 1)
      existing.y = (existing.y * existing.count + point.y) / (existing.count + 1)
      existing.count += 1
      existing.items.push(point.item)
    } else {
      bins.set(key, { x: point.x, y: point.y, count: 1, items: [point.item] })
    }
  }
  return [...bins.values()]
}

export interface LabelBox {
  x: number
  y: number
  width: number
  height: number
}

/** Greedy label placer: keeps a running list of placed boxes, rejects overlaps. */
export function create_label_placer() {
  const placed: LabelBox[] = []
  return {
    try_place(box: LabelBox): boolean {
      for (const other of placed) {
        if (box.x < other.x + other.width && box.x + box.width > other.x
          && box.y < other.y + other.height && box.y + box.height > other.y)
          return false
      }
      placed.push(box)
      return true
    },
  }
}

/**
 * Approximate geographic bbox of the visible viewport. Samples corner + edge
 * midpoints through `invert` (screen → [lng, lat]) since projected rectangles
 * curve in Equal Earth. Returns null when nothing inverts (shouldn't happen).
 */
export function view_bbox({ width, height, invert }: {
  width: number
  height: number
  invert: (point: [number, number]) => [number, number] | null
}): { west: number, south: number, east: number, north: number } | null {
  const samples: [number, number][] = [
    [0, 0], [width / 2, 0], [width, 0],
    [0, height / 2], [width, height / 2],
    [0, height], [width / 2, height], [width, height],
  ]
  let west = Infinity; let south = Infinity; let east = -Infinity; let north = -Infinity
  let any = false
  for (const sample of samples) {
    const inverted = invert(sample)
    if (!inverted)
      continue
    const [lng, lat] = inverted
    if (!Number.isFinite(lng) || !Number.isFinite(lat))
      continue
    any = true
    west = Math.min(west, Math.max(-180, lng))
    east = Math.max(east, Math.min(180, lng))
    south = Math.min(south, Math.max(-90, lat))
    north = Math.max(north, Math.min(90, lat))
  }
  if (!any)
    return null
  return { west, south, east, north }
}

export function bbox_contains({ bbox, lng, lat }: {
  bbox: { west: number, south: number, east: number, north: number }
  lng: number
  lat: number
}): boolean {
  return lng >= bbox.west && lng <= bbox.east && lat >= bbox.south && lat <= bbox.north
}

if (import.meta.vitest) {
  describe(cluster_points, () => {
    test('merges points in the same bin, keeps distant points separate', () => {
      const clusters = cluster_points({
        points: [
          { x: 10, y: 10, item: 'a' },
          { x: 12, y: 11, item: 'b' },
          { x: 200, y: 200, item: 'c' },
        ],
        bin_size: 12,
      })
      expect(clusters).toHaveLength(2)
      const merged = clusters.find(cluster => cluster.count === 2)
      expect(merged.items).toEqual(['a', 'b'])
      expect(merged.x).toBe(11)
    })
  })

  describe(create_label_placer, () => {
    test('rejects overlapping boxes, accepts disjoint ones', () => {
      const placer = create_label_placer()
      expect(placer.try_place({ x: 0, y: 0, width: 50, height: 12 })).toBe(true)
      expect(placer.try_place({ x: 40, y: 6, width: 50, height: 12 })).toBe(false)
      expect(placer.try_place({ x: 0, y: 20, width: 50, height: 12 })).toBe(true)
    })
  })

  describe(view_bbox, () => {
    test('clamps to world bounds', () => {
      const bbox = view_bbox({ width: 100, height: 50, invert: ([x, y]) => [x * 4 - 200, 100 - y * 4] })
      expect(bbox).toEqual({ west: -180, south: -90, east: 180, north: 90 })
    })
  })

  describe(bbox_contains, () => {
    test('inside and outside', () => {
      const bbox = { west: -10, south: -5, east: 10, north: 5 }
      expect(bbox_contains({ bbox, lng: 0, lat: 0 })).toBe(true)
      expect(bbox_contains({ bbox, lng: 20, lat: 0 })).toBe(false)
    })
  })
}
