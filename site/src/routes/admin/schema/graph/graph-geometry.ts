/**
 * Pure geometry for the hand-rolled schema-graph canvas (replaces the bits we
 * used to get from @xyflow/svelte: viewport zoom-to-cursor, fit-to-view, and
 * edge bezier routing). No DOM, no Svelte — unit-tested in isolation below.
 */

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 2

export interface Viewport {
  /** Screen-space translation of the world layer, in px. */
  x: number
  y: number
  /** Zoom factor. */
  k: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function clamp_zoom(k: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k))
}

/**
 * Zoom toward a screen point (cx,cy measured from the canvas top-left), keeping
 * the world point currently under the cursor pinned in place. `factor` > 1 zooms
 * in. When the new zoom is clamped to a limit the translation is left untouched.
 */
export function zoom_at_point({ viewport, cx, cy, factor }: { viewport: Viewport, cx: number, cy: number, factor: number }): Viewport {
  const k = clamp_zoom(viewport.k * factor)
  const ratio = k / viewport.k
  return {
    k,
    x: cx - (cx - viewport.x) * ratio,
    y: cy - (cy - viewport.y) * ratio,
  }
}

export function bounding_box(rects: Rect[]): Rect | null {
  if (rects.length === 0)
    return null
  let min_x = Infinity
  let min_y = Infinity
  let max_x = -Infinity
  let max_y = -Infinity
  for (const rect of rects) {
    min_x = Math.min(min_x, rect.x)
    min_y = Math.min(min_y, rect.y)
    max_x = Math.max(max_x, rect.x + rect.width)
    max_y = Math.max(max_y, rect.y + rect.height)
  }
  return { x: min_x, y: min_y, width: max_x - min_x, height: max_y - min_y }
}

/**
 * Compute the viewport that frames every rect inside a canvas of the given size,
 * with `padding` (fraction, 0–1) of slack. Mirrors xyflow's `fitView`.
 */
export function fit_view({ rects, canvas_width, canvas_height, padding = 0.15 }: { rects: Rect[], canvas_width: number, canvas_height: number, padding?: number }): Viewport {
  const box = bounding_box(rects)
  if (!box || box.width === 0 || box.height === 0 || canvas_width === 0 || canvas_height === 0)
    return { x: 0, y: 0, k: 1 }
  const k = clamp_zoom(Math.min(canvas_width / box.width, canvas_height / box.height) * (1 - padding))
  const x = (canvas_width - box.width * k) / 2 - box.x * k
  const y = (canvas_height - box.height * k) / 2 - box.y * k
  return { x, y, k }
}

/**
 * Cubic-bezier `d` string between two node anchor points. `s_dir` / `t_dir` are
 * the horizontal exit directions (+1 = the control point reaches out to the
 * right, -1 = to the left), so edges leave/enter on the facing sides of nodes.
 */
export function edge_path({ sx, sy, tx, ty, s_dir, t_dir }: { sx: number, sy: number, tx: number, ty: number, s_dir: number, t_dir: number }): string {
  const offset = Math.max(40, Math.abs(tx - sx) * 0.5)
  const c1x = sx + s_dir * offset
  const c2x = tx + t_dir * offset
  return `M ${sx},${sy} C ${c1x},${sy} ${c2x},${ty} ${tx},${ty}`
}

/** Short glyph for an ON DELETE action; `null` when there's nothing worth showing. */
export function on_delete_glyph(action: string): string | null {
  if (!action || action === 'NO ACTION')
    return null
  if (action === 'CASCADE')
    return '⤓'
  if (action === 'SET NULL')
    return '○'
  if (action === 'RESTRICT')
    return '⊘'
  if (action === 'SET DEFAULT')
    return '↺'
  return '?'
}

if (import.meta.vitest) {
  describe(clamp_zoom, () => {
    it('clamps to [MIN_ZOOM, MAX_ZOOM]', () => {
      expect(clamp_zoom(0.0001)).toBe(MIN_ZOOM)
      expect(clamp_zoom(99)).toBe(MAX_ZOOM)
      expect(clamp_zoom(1)).toBe(1)
    })
  })

  describe(zoom_at_point, () => {
    it('keeps the world point under the cursor fixed', () => {
      const viewport = { x: 0, y: 0, k: 1 }
      const cx = 200
      const cy = 100
      // World point currently under cursor.
      const world_x = (cx - viewport.x) / viewport.k
      const world_y = (cy - viewport.y) / viewport.k
      const next = zoom_at_point({ viewport, cx, cy, factor: 1.5 })
      // Same world point must still map to the same screen point.
      expect(next.x + world_x * next.k).toBeCloseTo(cx)
      expect(next.y + world_y * next.k).toBeCloseTo(cy)
      expect(next.k).toBe(1.5)
    })

    it('does not translate when zoom is already clamped at the max', () => {
      const viewport = { x: 30, y: 40, k: MAX_ZOOM }
      const next = zoom_at_point({ viewport, cx: 100, cy: 100, factor: 2 })
      expect(next).toEqual({ x: 30, y: 40, k: MAX_ZOOM })
    })
  })

  describe(bounding_box, () => {
    it('returns null for an empty set', () => {
      expect(bounding_box([])).toBeNull()
    })

    it('wraps every rect', () => {
      const box = bounding_box([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 90, y: 40, width: 20, height: 5 },
      ])
      expect(box).toEqual({ x: 0, y: 0, width: 110, height: 45 })
    })
  })

  describe(fit_view, () => {
    it('centers and scales the bbox into the canvas with padding', () => {
      const rects = [{ x: 0, y: 0, width: 100, height: 100 }]
      const vp = fit_view({ rects, canvas_width: 1000, canvas_height: 1000, padding: 0 })
      expect(vp.k).toBe(2) // min(1000/100,1000/100)=10, clamped to MAX_ZOOM 2
      // bbox 100x100 at k=2 → 200x200, centered in 1000 → offset (1000-200)/2 = 400.
      expect(vp.x).toBe(400)
      expect(vp.y).toBe(400)
    })

    it('returns identity for an empty / zero-size input', () => {
      expect(fit_view({ rects: [], canvas_width: 800, canvas_height: 600 })).toEqual({ x: 0, y: 0, k: 1 })
    })
  })

  describe(edge_path, () => {
    it('reaches outward on each handle side', () => {
      const d = edge_path({ sx: 100, sy: 50, tx: 300, ty: 80, s_dir: 1, t_dir: -1 })
      // offset = max(40, |300-100|*0.5) = 100 → c1x=200, c2x=200.
      expect(d).toBe('M 100,50 C 200,50 200,80 300,80')
    })

    it('honors a minimum control offset for near-vertical edges', () => {
      const d = edge_path({ sx: 100, sy: 0, tx: 110, ty: 200, s_dir: 1, t_dir: -1 })
      // |110-100|*0.5 = 5 < 40 → offset 40 → c1x=140, c2x=70.
      expect(d).toBe('M 100,0 C 140,0 70,200 110,200')
    })
  })

  describe(on_delete_glyph, () => {
    it('maps known actions and ignores NO ACTION / empty', () => {
      expect(on_delete_glyph('CASCADE')).toBe('⤓')
      expect(on_delete_glyph('SET NULL')).toBe('○')
      expect(on_delete_glyph('NO ACTION')).toBeNull()
      expect(on_delete_glyph('')).toBeNull()
    })
  })
}
