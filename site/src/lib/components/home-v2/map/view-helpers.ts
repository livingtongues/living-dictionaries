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

export const LABEL_HEIGHT = 13

export interface LabelItem {
  id: string
  /** Dot position (screen px). */
  x: number
  y: number
  /** Measured text width. */
  width: number
  /** Higher places first (entry_count). */
  priority: number
}

export interface PlacedLabel {
  id: string
  /** Text-box top-left offset relative to the dot. */
  dx: number
  dy: number
  width: number
  height: number
  /** Displaced beyond snug — draw a leader line dot → box. */
  leader: boolean
  /** Placed despite overlap (guarantee fallback). */
  overlapped: boolean
}

function boxes_overlap(a: LabelBox, b: LabelBox, pad = 2): boolean {
  return a.x < b.x + b.width + pad && a.x + a.width + pad > b.x
    && a.y < b.y + b.height + pad && a.y + a.height + pad > b.y
}

/** Candidate text-box offsets around a dot, snug sides first, then rings outward. */
function label_candidates(width: number): { dx: number, dy: number, leader: boolean }[] {
  const half_h = LABEL_HEIGHT / 2
  const snug = [
    { dx: 7, dy: -half_h, leader: false }, // right
    { dx: -7 - width, dy: -half_h, leader: false }, // left
    { dx: -width / 2, dy: -6 - LABEL_HEIGHT, leader: false }, // above
    { dx: -width / 2, dy: 6, leader: false }, // below
    { dx: 6, dy: -5 - LABEL_HEIGHT, leader: false },
    { dx: -width - 6, dy: -5 - LABEL_HEIGHT, leader: false },
    { dx: 6, dy: 5, leader: false },
    { dx: -width - 6, dy: 5, leader: false },
  ]
  const rings: { dx: number, dy: number, leader: boolean }[] = []
  for (const radius of [18, 26, 36, 48, 60]) {
    for (let step = 0; step < 12; step++) {
      const angle = (step / 12) * Math.PI * 2 + (radius % 2 === 0 ? 0.26 : 0)
      rings.push({
        dx: Math.cos(angle) * (radius + width / 4) - width / 2,
        dy: Math.sin(angle) * radius * 0.8 - half_h,
        leader: true,
      })
    }
  }
  return [...snug, ...rings]
}

/**
 * Deterministic any-side label placement: each dot's label tries snug positions
 * (right/left/above/below/corners) then rings outward, rejecting overlaps with
 * already-placed labels, dots, and the canvas edge. `guarantee: true` (fully
 * declustered views) falls back to snug-right even when it overlaps; otherwise
 * unplaceable items come back in `failed` (level 2 merges those into a cluster).
 */
export function layout_labels({ items, obstacles, bounds, guarantee }: {
  items: LabelItem[]
  /** Small boxes around every visible dot so labels don't cover other dots. */
  obstacles: LabelBox[]
  bounds: { width: number, height: number }
  guarantee: boolean
}): { placed: PlacedLabel[], failed: string[] } {
  const placed: PlacedLabel[] = []
  const failed: string[] = []
  const taken: LabelBox[] = [...obstacles]
  const sorted = [...items].sort((a, b) => b.priority - a.priority)
  for (const item of sorted) {
    let found: PlacedLabel | null = null
    for (const candidate of label_candidates(item.width)) {
      const box: LabelBox = { x: item.x + candidate.dx, y: item.y + candidate.dy, width: item.width, height: LABEL_HEIGHT }
      if (box.x < 2 || box.y < 2 || box.x + box.width > bounds.width - 2 || box.y + box.height > bounds.height - 2)
        continue
      if (taken.some(other => boxes_overlap(box, other)))
        continue
      found = { id: item.id, dx: candidate.dx, dy: candidate.dy, width: item.width, height: LABEL_HEIGHT, leader: candidate.leader, overlapped: false }
      break
    }
    if (!found) {
      if (!guarantee) {
        failed.push(item.id)
        continue
      }
      found = { id: item.id, dx: 7, dy: -LABEL_HEIGHT / 2, width: item.width, height: LABEL_HEIGHT, leader: false, overlapped: true }
    }
    placed.push(found)
    taken.push({ x: item.x + found.dx, y: item.y + found.dy, width: found.width, height: found.height })
  }
  return { placed, failed }
}

/**
 * Level-2 fallback for a single whose label could not be placed: fold it into
 * the nearest other cluster (within `max_distance`) so no unlabeled lone dot
 * ever renders. Mutates nothing — returns a new cluster array.
 */
export function apply_forced_merges<T>({ clusters, merged_ids, get_id, max_distance = 48 }: {
  clusters: Cluster<T>[]
  merged_ids: Set<string>
  get_id: (item: T) => string
  max_distance?: number
}): Cluster<T>[] {
  if (!merged_ids.size)
    return clusters
  const result: Cluster<T>[] = clusters.map(cluster => ({ ...cluster, items: [...cluster.items] }))
  const to_fold = result.filter(cluster => cluster.count === 1 && merged_ids.has(get_id(cluster.items[0])))
  for (const single of to_fold) {
    let nearest: Cluster<T> | null = null
    let nearest_distance = max_distance
    for (const other of result) {
      if (other === single || !other.count)
        continue
      const distance = Math.hypot(other.x - single.x, other.y - single.y)
      if (distance < nearest_distance) {
        nearest = other
        nearest_distance = distance
      }
    }
    if (!nearest)
      continue
    nearest.x = (nearest.x * nearest.count + single.x) / (nearest.count + 1)
    nearest.y = (nearest.y * nearest.count + single.y) / (nearest.count + 1)
    nearest.count += 1
    nearest.items.push(...single.items)
    single.count = 0
    single.items = []
  }
  return result.filter(cluster => cluster.count > 0)
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
    /** Register a box unconditionally (already placed by the force layout). */
    block(box: LabelBox) {
      placed.push(box)
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

  describe(layout_labels, () => {
    const bounds = { width: 800, height: 400 }

    test('a lone dot gets the snug right position, no leader', () => {
      const { placed, failed } = layout_labels({
        items: [{ id: 'a', x: 200, y: 200, width: 50, priority: 1 }],
        obstacles: [],
        bounds,
        guarantee: false,
      })
      expect(failed).toEqual([])
      expect(placed).toHaveLength(1)
      expect(placed[0].dx).toBe(7)
      expect(placed[0].leader).toBe(false)
    })

    test('every co-located dot still gets a label (any side / rings), none overlap', () => {
      const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) => ({
        id,
        x: 200 + (index % 2),
        y: 200 + (index % 3),
        width: 60,
        priority: index,
      }))
      const { placed, failed } = layout_labels({ items, obstacles: [], bounds, guarantee: true })
      expect(failed).toEqual([])
      expect(placed).toHaveLength(6)
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const item_i = items.find(item => item.id === placed[i].id)
          const item_j = items.find(item => item.id === placed[j].id)
          const box_i = { x: item_i.x + placed[i].dx, y: item_i.y + placed[i].dy, width: placed[i].width, height: placed[i].height }
          const box_j = { x: item_j.x + placed[j].dx, y: item_j.y + placed[j].dy, width: placed[j].width, height: placed[j].height }
          const disjoint = box_i.x + box_i.width <= box_j.x || box_j.x + box_j.width <= box_i.x
            || box_i.y + box_i.height <= box_j.y || box_j.y + box_j.height <= box_i.y
          expect(disjoint).toBe(true)
        }
      }
      expect(placed.some(label => label.leader)).toBe(true)
    })

    test('without guarantee an impossible label fails instead of overlapping', () => {
      // wall the dot in with obstacles covering the whole canvas
      const { placed, failed } = layout_labels({
        items: [{ id: 'a', x: 200, y: 200, width: 50, priority: 1 }],
        obstacles: [{ x: 0, y: 0, width: 800, height: 400 }],
        bounds,
        guarantee: false,
      })
      expect(placed).toEqual([])
      expect(failed).toEqual(['a'])
    })

    test('guarantee places even when everything overlaps', () => {
      const { placed, failed } = layout_labels({
        items: [{ id: 'a', x: 200, y: 200, width: 50, priority: 1 }],
        obstacles: [{ x: 0, y: 0, width: 800, height: 400 }],
        bounds,
        guarantee: true,
      })
      expect(failed).toEqual([])
      expect(placed[0].overlapped).toBe(true)
    })

    test('higher priority wins the snug spot', () => {
      const { placed } = layout_labels({
        items: [
          { id: 'small', x: 200, y: 200, width: 50, priority: 1 },
          { id: 'big', x: 204, y: 200, width: 50, priority: 9 },
        ],
        obstacles: [],
        bounds,
        guarantee: true,
      })
      const big = placed.find(label => label.id === 'big')
      expect(big.dx).toBe(7)
      expect(big.leader).toBe(false)
    })
  })

  describe(apply_forced_merges, () => {
    test('folds a failed single into the nearest cluster', () => {
      const clusters = [
        { x: 100, y: 100, count: 2, items: ['a', 'b'] },
        { x: 110, y: 104, count: 1, items: ['lonely'] },
        { x: 400, y: 100, count: 1, items: ['far'] },
      ]
      const merged = apply_forced_merges({ clusters, merged_ids: new Set(['lonely']), get_id: item => item })
      expect(merged).toHaveLength(2)
      const host = merged.find(cluster => cluster.items.includes('lonely'))
      expect(host.count).toBe(3)
      expect(host.items).toEqual(['a', 'b', 'lonely'])
    })

    test('a single too far from everything stays put', () => {
      const clusters = [
        { x: 100, y: 100, count: 1, items: ['a'] },
        { x: 400, y: 100, count: 1, items: ['lonely'] },
      ]
      const merged = apply_forced_merges({ clusters, merged_ids: new Set(['lonely']), get_id: item => item })
      expect(merged).toHaveLength(2)
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
