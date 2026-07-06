import { geoEqualEarth, geoPath } from 'd3-geo'
import { fetch_tile } from './tile-source'
import type { TileLayers } from './tile-source'
import { get_bucket_style, get_label_spec, WATER_COLOR } from './map-style'
import type { BucketStyle, LabelSpec } from './map-style'

// Zoomable-map-tiles without a mapping library: mercator Z/X/Y tiles supply VECTOR
// geometry drawn through an Equal Earth projection. Each tile is rasterized ONCE into an
// offscreen bitmap at a power-of-two-quantized projection scale (a d3-zoom transform is an
// exact affine map of projected coordinates, so quantized bitmaps stay geometrically true);
// every frame just blits the visible bitmaps and draws labels vector-crisp on top.
// Rasterization is time-budgeted per frame — stale bitmaps keep displaying (scaled ≤2×)
// until their replacement is ready, so zooming never hitches.

const TILE_BASE_PX = 256
const MAX_DATA_ZOOM = 6
const MERCATOR_LAT_LIMIT = 85.05113
const MAX_CONCURRENT_FETCHES = 8
const CACHE_CAP = 400
const BITMAP_CAP = 80
const SAMPLE_STEP_PX = 60
const FIT_PADDING = 12
const MAX_LABELS_DRAWN = 180
const RASTER_MARGIN_PATH_PX = 24 // covers the tiles' data buffers → neighboring bitmaps overlap, hiding seams
const RASTER_BUDGET_MS = 8
// landcover blobs are raster-traced per tile and regionally stop short of tile edges;
// fatten their fills by a fraction of the tile span to knit tiles together
const LANDCOVER_BLEED_FRACTION = 0.05

interface TileAddress { z: number, x: number, y: number }
interface BuiltBucket { style: BucketStyle, path: Path2D }
interface TileBitmap {
  quantized_k: number
  canvas: OffscreenCanvas | HTMLCanvasElement
  origin_x: number // path coords at quantized_k
  origin_y: number
  width_path: number
  height_path: number
}
interface TileEntry {
  address: TileAddress
  status: 'loading' | 'ready' | 'empty' | 'error'
  layers?: TileLayers
  labels?: LabelSpec[]
  bitmap?: TileBitmap
}

export interface ZoomTransform { k: number, x: number, y: number }
export interface MapStats { k: number, display_z: number, data_z: number, drawn: number, pending: number, cached: number, frame_ms: number }

export function create_tile_map({ canvas, on_stats }: { canvas: HTMLCanvasElement, on_stats?: (stats: MapStats) => void }) {
  const ctx = canvas.getContext('2d')
  const base = geoEqualEarth()
  const cache = new Map<string, TileEntry>()
  const fetch_queue: TileEntry[] = []
  const text_widths = new Map<string, number>()
  let width = 0
  let height = 0
  let dpr = 1
  let world_width = 1
  let transform: ZoomTransform = { k: 1, x: 0, y: 0 }
  let inflight = 0
  let frame = 0
  let destroyed = false
  let last_interaction = 0

  function resize() {
    if (destroyed) return
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    width = canvas.clientWidth
    height = canvas.clientHeight
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    base.fitExtent([[FIT_PADDING, FIT_PADDING], [width - FIT_PADDING, height - FIT_PADDING]], { type: 'Sphere' })
    const [[left], [right]] = geoPath(base).bounds({ type: 'Sphere' })
    world_width = right - left
    for (const entry of cache.values()) entry.bitmap = undefined // path coords derive from base scale
    schedule_draw()
  }

  function set_transform(next: ZoomTransform) {
    transform = next
    last_interaction = performance.now()
    schedule_draw()
  }

  function project_base(lonlat: [number, number]) {
    return base(lonlat)
  }

  function schedule_draw() {
    if (destroyed || frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      draw()
    })
  }

  function tile_key({ z, x, y }: TileAddress) {
    return `${z}/${x}/${y}`
  }

  function lat_to_tile_row({ lat, count }: { lat: number, count: number }) {
    const row = Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * count)
    return Math.max(0, Math.min(count - 1, row))
  }

  function tile_row_to_lat({ row, count }: { row: number, count: number }) {
    return Math.atan(Math.sinh(Math.PI * (1 - 2 * row / count))) * 180 / Math.PI
  }

  function visible_tiles(data_z: number): TileAddress[] {
    const count = 2 ** data_z
    const addresses: TileAddress[] = []
    if (data_z <= 2) {
      for (let x = 0; x < count; x++) for (let y = 0; y < count; y++) addresses.push({ z: data_z, x, y })
      return addresses
    }
    // invert a viewport sample grid to geographic bounds, then cover them with tiles
    let min_lon = Infinity
    let max_lon = -Infinity
    let min_lat = Infinity
    let max_lat = -Infinity
    const sample_axis = (extent: number) => {
      const stops: number[] = []
      for (let position = 0; position <= extent; position += SAMPLE_STEP_PX) stops.push(position)
      if (stops[stops.length - 1] !== extent) stops.push(extent)
      return stops
    }
    for (const sx of sample_axis(width)) {
      for (const sy of sample_axis(height)) {
        const px = (sx - transform.x) / transform.k
        const py = (sy - transform.y) / transform.k
        const lonlat = base.invert?.([px, py])
        if (!lonlat) continue
        const round_trip = base(lonlat)
        if (!round_trip || Math.hypot(round_trip[0] - px, round_trip[1] - py) > 0.5) continue // off the globe
        min_lon = Math.min(min_lon, lonlat[0])
        max_lon = Math.max(max_lon, lonlat[0])
        min_lat = Math.min(min_lat, lonlat[1])
        max_lat = Math.max(max_lat, lonlat[1])
      }
    }
    if (min_lon > max_lon || min_lat > max_lat) return addresses
    const clamp_lat = (lat: number) => Math.max(-MERCATOR_LAT_LIMIT, Math.min(MERCATOR_LAT_LIMIT, lat))
    const x_start = Math.max(0, Math.floor((min_lon + 180) / 360 * count))
    const x_end = Math.min(count - 1, Math.floor((max_lon + 180) / 360 * count))
    const y_start = lat_to_tile_row({ lat: clamp_lat(max_lat), count })
    const y_end = lat_to_tile_row({ lat: clamp_lat(min_lat), count })
    for (let x = x_start; x <= x_end; x++) for (let y = y_start; y <= y_end; y++) addresses.push({ z: data_z, x, y })
    return addresses
  }

  function ensure_tile(address: TileAddress): TileEntry {
    const key = tile_key(address)
    const existing = cache.get(key)
    if (existing) return existing
    const entry: TileEntry = { address, status: 'loading' }
    cache.set(key, entry)
    fetch_queue.push(entry)
    pump_fetches()
    return entry
  }

  function pump_fetches() {
    while (inflight < MAX_CONCURRENT_FETCHES && fetch_queue.length) {
      const entry = fetch_queue.shift()
      inflight++
      fetch_tile(entry.address)
        .then((layers) => {
          entry.status = layers ? 'ready' : 'empty'
          entry.layers = layers
          entry.labels = layers ? extract_labels(layers) : []
        })
        .catch((fetch_error) => {
          entry.status = 'error'
          console.error('tile fetch failed', entry.address, fetch_error)
        })
        .finally(() => {
          inflight--
          if (destroyed) return
          pump_fetches()
          schedule_draw()
        })
    }
  }

  function extract_labels(layers: TileLayers): LabelSpec[] {
    const labels: LabelSpec[] = []
    for (const [layer_name, features] of Object.entries(layers)) {
      for (const feature of features) {
        const spec = get_label_spec({ layer: layer_name, geom_type: feature.geom_type, properties: feature.properties, geometry: feature.geojson.geometry })
        if (spec) labels.push(spec)
      }
    }
    return labels
  }

  function quantized_projection(quantized_k: number) {
    return geoEqualEarth()
      .scale(base.scale() * quantized_k)
      .translate([base.translate()[0] * quantized_k, base.translate()[1] * quantized_k])
      .precision(1)
  }

  // cap a tile's rasterization scale by its own zoom level so ancestor tiles shown at deep
  // zoom don't produce giant bitmaps — they display scaled until real children replace them
  function desired_quantization({ address, quantized_k }: { address: TileAddress, quantized_k: number }) {
    const cap = 2 ** Math.max(0, Math.floor(Math.log2(2048 * 2 ** address.z / (world_width * dpr))))
    return Math.min(quantized_k, cap)
  }

  function build_buckets(entry: TileEntry, quantized_k: number): BuiltBucket[] {
    const writer = geoPath(quantized_projection(quantized_k))
    const buckets = new Map<string, BuiltBucket>()
    for (const [layer_name, features] of Object.entries(entry.layers || {})) {
      for (const feature of features) {
        const kind = String(feature.properties.kind ?? '')
        const style = get_bucket_style({ layer: layer_name, kind, geom_type: feature.geom_type })
        if (!style) continue
        const bucket_key = `${layer_name}|${kind}|${feature.geom_type}`
        let bucket = buckets.get(bucket_key)
        if (!bucket) {
          bucket = { style, path: new Path2D() }
          buckets.set(bucket_key, bucket)
        }
        writer.context(bucket.path as unknown as CanvasRenderingContext2D)(feature.geojson)
      }
    }
    return [...buckets.values()].sort((a, b) => a.style.order - b.style.order)
  }

  function tile_path_bounds(address: TileAddress, quantized_k: number) {
    const projection = quantized_projection(quantized_k)
    const count = 2 ** address.z
    const lon_start = address.x / count * 360 - 180
    const lon_end = (address.x + 1) / count * 360 - 180
    const lat_south = tile_row_to_lat({ row: address.y + 1, count })
    const lat_north = tile_row_to_lat({ row: address.y, count })
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (let step = 0; step <= 8; step++) {
      const lon = lon_start + (lon_end - lon_start) * step / 8
      const lat = lat_south + (lat_north - lat_south) * step / 8
      for (const point of [[lon, lat_south], [lon, lat_north], [lon_start, lat], [lon_end, lat]] as [number, number][]) {
        const projected = projection(point)
        if (!projected) continue
        x0 = Math.min(x0, projected[0])
        y0 = Math.min(y0, projected[1])
        x1 = Math.max(x1, projected[0])
        y1 = Math.max(y1, projected[1])
      }
    }
    return { x0, y0, x1, y1 }
  }

  function rasterize_tile(entry: TileEntry, quantized_k: number) {
    const bounds = tile_path_bounds(entry.address, quantized_k)
    if (!Number.isFinite(bounds.x0)) return
    const origin_x = bounds.x0 - RASTER_MARGIN_PATH_PX
    const origin_y = bounds.y0 - RASTER_MARGIN_PATH_PX
    const width_path = bounds.x1 - bounds.x0 + RASTER_MARGIN_PATH_PX * 2
    const height_path = bounds.y1 - bounds.y0 + RASTER_MARGIN_PATH_PX * 2
    const pixel_scale = Math.min(dpr, 4096 / width_path, 4096 / height_path)
    const pixel_width = Math.ceil(width_path * pixel_scale)
    const pixel_height = Math.ceil(height_path * pixel_scale)
    if (pixel_width < 1 || pixel_height < 1) return
    const bitmap_canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(pixel_width, pixel_height)
      : Object.assign(document.createElement('canvas'), { width: pixel_width, height: pixel_height })
    const bitmap_ctx = bitmap_canvas.getContext('2d') as CanvasRenderingContext2D | null
    if (!bitmap_ctx) return
    bitmap_ctx.setTransform(pixel_scale, 0, 0, pixel_scale, -origin_x * pixel_scale, -origin_y * pixel_scale)
    const bleed_width = Math.max(1, (bounds.x1 - bounds.x0) * LANDCOVER_BLEED_FRACTION)
    for (const { style, path } of build_buckets(entry, quantized_k)) {
      if (style.type === 'fill') {
        bitmap_ctx.fillStyle = style.color
        bitmap_ctx.fill(path)
        if (style.bleed) { // knit landcover's tile-edge gaps with a same-color fattening stroke
          bitmap_ctx.strokeStyle = style.color
          bitmap_ctx.lineWidth = bleed_width
          bitmap_ctx.stroke(path)
        }
      } else {
        bitmap_ctx.strokeStyle = style.color
        bitmap_ctx.lineWidth = style.width
        bitmap_ctx.setLineDash(style.dash || [])
        bitmap_ctx.stroke(path)
        bitmap_ctx.setLineDash([])
      }
    }
    entry.bitmap = { quantized_k, canvas: bitmap_canvas, origin_x, origin_y, width_path, height_path }
  }

  function draw() {
    if (!ctx || destroyed || !width || !height) return
    const frame_start = performance.now()
    const display_z = Math.log2(Math.max(transform.k * world_width / TILE_BASE_PX, 1e-6))
    const data_z = Math.max(0, Math.min(MAX_DATA_ZOOM, Math.round(display_z)))
    const needed = visible_tiles(data_z)

    // best-available set: ready target tiles, else nearest ready ancestor (drawn first, occluded by children)
    const draw_map = new Map<string, TileEntry>()
    for (const address of needed) {
      const entry = ensure_tile(address)
      if (entry.status === 'ready') {
        draw_map.set(tile_key(address), entry)
        continue
      }
      let { z, x, y } = address
      while (z > 0) {
        z -= 1
        x >>= 1
        y >>= 1
        const ancestor = cache.get(tile_key({ z, x, y }))
        if (ancestor?.status === 'ready') {
          draw_map.set(tile_key({ z, x, y }), ancestor)
          break
        }
      }
    }
    const ordered = [...draw_map.values()].sort((a, b) => a.address.z - b.address.z)

    // Rasterization policy: while the user is actively zooming/panning, NEVER rebuild
    // stale bitmaps (they display scaled — a dense tile rebuild would blow the frame);
    // only paint at most one fresh-loaded tile per frame. At idle, chew through
    // rebuilds time-budgeted until everything matches the current quantization.
    const interacting = performance.now() - last_interaction < 150
    const quantized_k = 2 ** Math.floor(Math.log2(transform.k))
    let rasterized = 0
    let needs_more = false
    for (const entry of ordered) {
      const target_k = desired_quantization({ address: entry.address, quantized_k })
      const fresh = !entry.bitmap
      const stale = entry.bitmap && entry.bitmap.quantized_k !== target_k
      if (!fresh && !stale) continue
      const allowed = interacting
        ? fresh && rasterized === 0
        : rasterized === 0 || performance.now() - frame_start < RASTER_BUDGET_MS
      if (allowed) {
        rasterize_tile(entry, target_k)
        rasterized++
      } else {
        needs_more = true
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const current_projection = geoEqualEarth()
      .scale(base.scale() * transform.k)
      .translate([transform.x + base.translate()[0] * transform.k, transform.y + base.translate()[1] * transform.k])
    ctx.beginPath()
    geoPath(current_projection, ctx)({ type: 'Sphere' })
    ctx.fillStyle = WATER_COLOR
    ctx.fill()
    ctx.strokeStyle = '#b9b5aa'
    ctx.lineWidth = 1
    ctx.stroke()

    for (const entry of ordered) {
      const { bitmap } = entry
      if (!bitmap) {
        needs_more = true
        continue
      }
      const scale = transform.k / bitmap.quantized_k
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * transform.x, dpr * transform.y)
      ctx.drawImage(bitmap.canvas, bitmap.origin_x, bitmap.origin_y, bitmap.width_path, bitmap.height_path)
    }

    draw_labels({ tiles: ordered, display_z })

    const frame_ms = performance.now() - frame_start
    on_stats?.({ k: transform.k, display_z, data_z, drawn: draw_map.size, pending: inflight + fetch_queue.length, cached: cache.size, frame_ms })
    trim_cache(draw_map)
    if (needs_more) schedule_draw()
  }

  function measure_label(label: LabelSpec): number {
    const key = `${label.size}|${label.weight}|${label.italic ? 1 : 0}|${label.name}`
    let measured = text_widths.get(key)
    if (measured === undefined) {
      ctx.font = `${label.italic ? 'italic ' : ''}${label.weight} ${label.size}px system-ui, sans-serif`
      measured = ctx.measureText(label.name).width
      text_widths.set(key, measured)
    }
    return measured
  }

  function draw_labels({ tiles, display_z }: { tiles: TileEntry[], display_z: number }) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const by_name = new Map<string, LabelSpec>()
    for (const entry of tiles) {
      for (const label of entry.labels || []) {
        if (label.min_zoom > display_z + 0.5) continue
        const existing = by_name.get(label.name)
        if (!existing || label.priority < existing.priority) by_name.set(label.name, label)
      }
    }
    const candidates = [...by_name.values()].sort((a, b) => a.priority - b.priority)
    const placed: { x0: number, y0: number, x1: number, y1: number }[] = []
    let drawn = 0
    ctx.lineJoin = 'round'
    ctx.textBaseline = 'middle'
    for (const label of candidates) {
      if (drawn >= MAX_LABELS_DRAWN) break
      const projected = base(label.lonlat)
      if (!projected) continue
      const sx = transform.x + transform.k * projected[0]
      const sy = transform.y + transform.k * projected[1]
      if (sx < -50 || sx > width + 50 || sy < -20 || sy > height + 20) continue
      const text_width = measure_label(label)
      const half_height = label.size * 0.75
      const box = label.dot
        ? { x0: sx - 4, y0: sy - half_height, x1: sx + 8 + text_width, y1: sy + half_height }
        : { x0: sx - text_width / 2 - 2, y0: sy - half_height, x1: sx + text_width / 2 + 2, y1: sy + half_height }
      if (placed.some(other => box.x0 < other.x1 && box.x1 > other.x0 && box.y0 < other.y1 && box.y1 > other.y0)) continue
      placed.push(box)
      drawn++
      ctx.font = `${label.italic ? 'italic ' : ''}${label.weight} ${label.size}px system-ui, sans-serif`
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 3
      ctx.fillStyle = label.color
      if (label.dot) {
        ctx.beginPath()
        ctx.arc(sx, sy, 2.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.textAlign = 'left'
        ctx.strokeText(label.name, sx + 6, sy)
        ctx.fillText(label.name, sx + 6, sy)
      } else {
        ctx.textAlign = 'center'
        ctx.strokeText(label.name, sx, sy)
        ctx.fillText(label.name, sx, sy)
      }
    }
  }

  function trim_cache(active: Map<string, TileEntry>) {
    let bitmaps = 0
    for (const entry of cache.values()) if (entry.bitmap) bitmaps++
    if (bitmaps > BITMAP_CAP) {
      for (const [key, entry] of cache) {
        if (bitmaps <= BITMAP_CAP) break
        if (active.has(key) || !entry.bitmap) continue
        entry.bitmap = undefined
        bitmaps--
      }
    }
    if (cache.size <= CACHE_CAP) return
    for (const [key, entry] of cache) {
      if (cache.size <= CACHE_CAP) break
      if (active.has(key) || entry.status === 'loading') continue
      cache.delete(key)
    }
  }

  function destroy() {
    destroyed = true
    if (frame) cancelAnimationFrame(frame)
  }

  return { resize, set_transform, project_base, destroy }
}
