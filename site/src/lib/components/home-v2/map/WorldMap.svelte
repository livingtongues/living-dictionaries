<script lang="ts">
  import type { ZoomTransform } from 'd3'
  import type { MapDict } from '../types'
  import type { MapColors } from './theme-colors'
  import type { Cluster, PlacedLabel } from './view-helpers'
  import type { SsrMap } from './ssr-map'
  import { geoContains, geoPath, select, zoom, zoomIdentity } from 'd3'
  import { onMount } from 'svelte'
  import * as topojson from 'topojson-client'
  import { page } from '$app/state'
  import countries110_topo from './data/countries-110m.json'
  import country_labels from './data/country-labels.json'
  import { fit_equal_earth, MAX_ZOOM, MIN_ZOOM } from './projection'
  import { read_map_colors } from './theme-colors'
  import { apply_forced_merges, cluster_points, create_label_placer, LABEL_HEIGHT, layout_labels, view_bbox } from './view-helpers'
  import IconMdiArrowCollapseAll from '~icons/mdi/arrow-collapse-all'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiMapMarker from '~icons/mdi/map-marker'

  export interface MapView {
    k: number
    bbox: { west: number, south: number, east: number, north: number } | null
  }

  export interface ConnectorLabel {
    dict_id: string
    opacity: number
  }

  interface Props {
    dicts: MapDict[]
    ssr_map: SsrMap
    highlighted_dict_id?: string | null
    /** Card-strip connector: these dicts' labels render red with an entry-count suffix (crossfading via opacity). */
    connector_labels?: ConnectorLabel[]
    on_view_change?: (view: MapView) => void
  }

  const { dicts, ssr_map, highlighted_dict_id = null, connector_labels = [], on_view_change }: Props = $props()
  const t = $derived(page.data.t)

  const located_dicts = $derived(dicts.filter(dict => dict.lat !== null && dict.lng !== null))
  const dict_by_id = $derived(new Map(located_dicts.map(dict => [dict.id, dict])))

  let container: HTMLDivElement = $state()
  let canvas: HTMLCanvasElement = $state()
  let swatches: HTMLDivElement = $state()
  let canvas_ready = $state(false)
  let hint: 'touch' | null = $state(null)
  /** Current zoom scale, mirrored for reactive UI (the reset button hides at full-out). */
  let zoom_level = $state(MIN_ZOOM)
  let hover_dot = $state(false)
  let hover_tip = $state<{ x: number, y: number, count: number, dict: MapDict } | null>(null)
  let selected_dict: MapDict | null = $state(null)
  let popover_position = $state({ x: 0, y: 0, above: true })

  // --- non-reactive rendering state ---
  let context: CanvasRenderingContext2D
  let width = 0
  let height = 0
  let dpr = 1
  let transform: ZoomTransform = zoomIdentity
  let base_projection: ReturnType<typeof fit_equal_earth> | null = null
  let land_path: Path2D | null = null
  let borders_path: Path2D | null = null
  /** Country polygons (geographic) for click hit-testing → zoom-to-country. */
  let country_features: GeoJSON.Feature[] = []
  let base_dots: { x: number, y: number, dict: MapDict }[] = []
  let visible_clusters: Cluster<MapDict>[] = []
  let colors: MapColors | null = null
  let font_family = 'sans-serif'
  let reduced_motion = false
  let draw_scheduled = false
  let zoom_behavior: ReturnType<typeof zoom<HTMLCanvasElement, unknown>>
  let hi_res: { land: Path2D, borders: Path2D } | null = null
  let hi_res_loading = false
  let admin1_labels: [string, number, number, number][] | null = null
  let admin1_loading = false
  let city_labels: [string, number, number, number, number][] | null = null
  let cities_loading = false
  let hint_timeout: ReturnType<typeof setTimeout> | null = null
  const text_widths: Record<string, number> = {}

  /** Click depth: 0 world → 1 country fit → 2 the closer third level (declustered). */
  let zoom_depth = 0
  /** Settled-view force layout of dict labels (offsets relative to each dot). */
  let label_layout = new Map<string, PlacedLabel>()
  /** Level-2 singles whose label could not be placed — folded into a nearby cluster. */
  let merged_ids = new Set<string>()
  let layout_key = ''
  let last_transform_change = 0
  let layout_retry_timeout: ReturnType<typeof setTimeout> | null = null
  const LAYOUT_SETTLE_MS = 150

  function rebuild_geometry() {
    if (!container)
      return
    width = container.clientWidth
    height = container.clientHeight
    if (width === 0 || height === 0)
      return
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    base_projection = fit_equal_earth({ width, height })
    build_paths()
    base_dots = located_dicts
      .map((dict) => {
        const projected = base_projection([dict.lng, dict.lat])
        if (!projected)
          return null
        return { x: projected[0], y: projected[1], dict }
      })
      .filter(Boolean)
    if (zoom_behavior) {
      zoom_behavior
        .extent([[0, 0], [width, height]])
        .translateExtent([[0, 0], [width, height]])
    }
    schedule_draw()
  }

  function build_paths() {
    if (!base_projection)
      return
    const path = geoPath(base_projection).digits(1)
    if (hi_res) {
      // hi-res Path2Ds are rebuilt against the current projection below
      hi_res = null
      load_hi_res()
    }
    // land silhouette merged from the country polygons — saves shipping land-110m
    const land = topojson.merge(countries110_topo as any, (countries110_topo as any).objects.countries.geometries)
    const borders = topojson.mesh(countries110_topo as any, (countries110_topo as any).objects.countries, (a: any, b: any) => a !== b)
    if (!country_features.length)
      country_features = (topojson.feature(countries110_topo as any, (countries110_topo as any).objects.countries) as any).features
    land_path = new Path2D(path(land as any) ?? '')
    borders_path = new Path2D(path(borders as any) ?? '')
    schedule_draw()
  }

  async function load_hi_res() {
    if (hi_res || hi_res_loading || !base_projection)
      return
    hi_res_loading = true
    try {
      const countries50 = await import('./data/countries-50m.json').then(module => module.default)
      const path = geoPath(base_projection).digits(1)
      const land = topojson.merge(countries50 as any, (countries50 as any).objects.countries.geometries)
      const borders = topojson.mesh(countries50 as any, (countries50 as any).objects.countries, (a: any, b: any) => a !== b)
      hi_res = {
        land: new Path2D(path(land as any) ?? ''),
        borders: new Path2D(path(borders as any) ?? ''),
      }
      schedule_draw()
    } finally {
      hi_res_loading = false
    }
  }

  async function load_admin1() {
    if (admin1_labels || admin1_loading)
      return
    admin1_loading = true
    try {
      const response = await fetch('/map-data/admin1.json')
      if (response.ok)
        admin1_labels = await response.json()
      schedule_draw()
    } catch { /* labels are progressive enhancement */ }
  }

  async function load_cities() {
    if (city_labels || cities_loading)
      return
    cities_loading = true
    try {
      const response = await fetch('/map-data/cities.json')
      if (response.ok)
        city_labels = await response.json()
      schedule_draw()
    } catch { /* labels are progressive enhancement */ }
  }

  function schedule_draw() {
    if (draw_scheduled)
      return
    draw_scheduled = true
    requestAnimationFrame(() => {
      draw_scheduled = false
      draw()
    })
  }

  function measure(text: string, font: string): number {
    const key = `${font}|${text}`
    let cached = text_widths[key]
    if (cached === undefined) {
      context.font = font
      cached = context.measureText(text).width
      text_widths[key] = cached
    }
    return cached
  }

  function screen_of(base_x: number, base_y: number): [number, number] {
    return [base_x * transform.k + transform.x, base_y * transform.k + transform.y]
  }

  export function project_point({ lng, lat }: { lng: number, lat: number }): { x: number, y: number } | null {
    if (!base_projection)
      return null
    const projected = base_projection([lng, lat])
    if (!projected)
      return null
    const [x, y] = screen_of(projected[0], projected[1])
    return { x, y }
  }

  function current_bbox() {
    if (!base_projection)
      return null
    return view_bbox({
      width,
      height,
      invert: ([x, y]) => {
        const inverted = base_projection.invert?.([(x - transform.x) / transform.k, (y - transform.y) / transform.k])
        return inverted ?? null
      },
    })
  }

  function draw_label({ text, x, y, font, fill, halo, placer, align = 'left' }: {
    text: string
    x: number
    y: number
    font: string
    fill: string
    halo: string
    placer: ReturnType<typeof create_label_placer>
    align?: 'left' | 'center'
  }): boolean {
    const text_width = measure(text, font)
    const box_x = align === 'center' ? x - text_width / 2 : x
    if (box_x + text_width < 0 || box_x > width || y < 0 || y - 12 > height)
      return false
    if (!placer.try_place({ x: box_x - 2, y: y - 11, width: text_width + 4, height: 14 }))
      return false
    context.font = font
    context.textAlign = align === 'center' ? 'center' : 'left'
    context.strokeStyle = halo
    context.lineWidth = 3
    context.lineJoin = 'round'
    context.strokeText(text, x, y)
    context.fillStyle = fill
    context.fillText(text, x, y)
    return true
  }

  function connector_text(dict: MapDict): string {
    return `${dict.name} · ${dict.entry_count.toLocaleString(page.data.locale || 'en')} ${t('home_v2.entries')}`
  }

  /** Halo + fill text at a known position (already placed by the force layout). */
  function draw_plain_label({ text, x, y, font, fill, alpha = 1, align = 'left' }: {
    text: string
    x: number
    y: number
    font: string
    fill: string
    alpha?: number
    align?: 'left' | 'center'
  }) {
    context.globalAlpha = alpha
    context.font = font
    context.textAlign = align
    context.strokeStyle = colors.label_halo
    context.lineWidth = 3
    context.lineJoin = 'round'
    context.strokeText(text, x, y)
    context.fillStyle = fill
    context.fillText(text, x, y)
    context.globalAlpha = 1
    context.textAlign = 'left'
  }

  /** Thin blue line from a dot to its displaced label box. */
  function draw_leader({ dot, box }: { dot: { x: number, y: number }, box: { x: number, y: number, width: number, height: number } }) {
    const target_x = Math.max(box.x, Math.min(box.x + box.width, dot.x))
    const target_y = Math.max(box.y, Math.min(box.y + box.height, dot.y))
    const dx = target_x - dot.x
    const dy = target_y - dot.y
    const distance = Math.hypot(dx, dy)
    if (distance < 6)
      return
    const start = 4.5 / distance
    context.beginPath()
    context.moveTo(dot.x + dx * start, dot.y + dy * start)
    context.lineTo(target_x, target_y)
    context.strokeStyle = colors.dot
    context.globalAlpha = 0.6
    context.lineWidth = 1
    context.stroke()
    context.globalAlpha = 1
  }

  /**
   * Recompute the dict-label force layout once the view has settled (debounced
   * — during zoom/pan animation the previous offsets keep riding their dots).
   */
  function maybe_refresh_layout({ declustered, base_clusters, dict_font }: {
    declustered: boolean
    base_clusters: Cluster<MapDict>[]
    dict_font: string
  }) {
    const key = `${transform.k.toFixed(3)}|${transform.x.toFixed(1)}|${transform.y.toFixed(1)}|${declustered}|${width}x${height}`
    if (key === layout_key)
      return
    if (performance.now() - last_transform_change < LAYOUT_SETTLE_MS) {
      if (!layout_retry_timeout) {
        layout_retry_timeout = setTimeout(() => {
          layout_retry_timeout = null
          schedule_draw()
        }, LAYOUT_SETTLE_MS + 20)
      }
      return
    }
    layout_key = key
    const bounds = { width, height }
    const make_items = (clusters: Cluster<MapDict>[]) => clusters
      .filter(cluster => cluster.count === 1)
      .map((cluster) => {
        const [dict] = cluster.items
        return { id: dict.id, x: cluster.x, y: cluster.y, width: measure(dict.name, dict_font) + 4, priority: dict.entry_count }
      })
    const make_obstacles = (clusters: Cluster<MapDict>[]) => clusters.map((cluster) => {
      const radius = cluster.count > 1 ? Math.min(4 + cluster.count * 0.45, 10) : 3.5
      return { x: cluster.x - radius, y: cluster.y - radius, width: radius * 2, height: radius * 2 }
    })

    // level 2 AND level 3 share one path: place every label that FITS, then fold
    // the unplaceable singles into a nearby cluster so text never overlaps. At
    // level 3 base_clusters are all singles (sparse areas fully decluster); dense
    // pockets (e.g. the Guatemalan highlands) keep a cluster until you zoom in
    // enough for the labels to fit.
    const first = layout_labels({ items: make_items(base_clusters), obstacles: make_obstacles(base_clusters), bounds, guarantee: false })
    if (!first.failed.length) {
      merged_ids = new Set()
      label_layout = new Map(first.placed.map(label => [label.id, label]))
      return
    }
    merged_ids = new Set(first.failed)
    const merged_clusters = apply_forced_merges({ clusters: base_clusters, merged_ids, get_id: dict => dict.id })
    const second = layout_labels({ items: make_items(merged_clusters), obstacles: make_obstacles(merged_clusters), bounds, guarantee: true })
    label_layout = new Map(second.placed.map(label => [label.id, label]))
  }

  function draw() {
    if (!context || !base_projection || !land_path || !colors)
      return
    const { k, x: tx, y: ty } = transform

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, width, height)

    // land + borders (transformed base-space Path2D — no re-projection cost).
    // hi-res may be idle-prefetched, but only draw it once zoomed in: the pulse
    // ring keeps a rAF loop alive at k=1 and 110m is much cheaper per frame
    context.setTransform(dpr * k, 0, 0, dpr * k, dpr * tx, dpr * ty)
    const use_hi_res = k >= 2.5 && hi_res
    const active_land = use_hi_res ? hi_res.land : land_path
    const active_borders = use_hi_res ? hi_res.borders : borders_path
    context.fillStyle = colors.land
    context.fill(active_land)
    if (active_borders) {
      context.strokeStyle = colors.border
      context.lineWidth = 0.7 / k
      context.stroke(active_borders)
    }

    // everything else in screen space
    context.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (k >= 2.5)
      load_hi_res()
    if (k >= 4.5)
      load_admin1()
    if (k >= 5.5)
      load_cities()

    const placer = create_label_placer()
    const label_font = `500 10.5px ${font_family}`
    const dict_font = `600 11px ${font_family}`

    // dictionary dots — clustered while zoomed out, fully individual at level 3
    const on_screen: { x: number, y: number, item: MapDict }[] = []
    for (const dot of base_dots) {
      const [x, y] = screen_of(dot.x, dot.y)
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20)
        continue
      on_screen.push({ x, y, item: dot.dict })
    }
    const declustered = (zoom_depth >= 2 && k >= 3) || k >= 8
    const labels_active = zoom_depth >= 1 || k >= 3.5
    const base_clusters = declustered
      ? on_screen.map(point => ({ x: point.x, y: point.y, count: 1, items: [point.item] }))
      : cluster_points({ points: on_screen, bin_size: k < 4 ? 14 : 7 })

    // settled-view force layout: every single dot gets a name (any side, blue
    // leader when pushed); level-2 singles that can't fit fold into a cluster
    if (labels_active) {
      maybe_refresh_layout({ declustered, base_clusters, dict_font })
    } else if (label_layout.size) {
      label_layout = new Map()
      merged_ids = new Set()
      layout_key = ''
    }
    visible_clusters = merged_ids.size
      ? apply_forced_merges({ clusters: base_clusters, merged_ids, get_id: dict => dict.id })
      : base_clusters

    const singles_pos: Record<string, { x: number, y: number }> = {}
    for (const cluster of visible_clusters) {
      if (cluster.count === 1)
        singles_pos[cluster.items[0].id] = { x: cluster.x, y: cluster.y }
    }
    const connector_alpha = new Map(connector_labels.filter(label => label.opacity > 0.01).map(label => [label.dict_id, label.opacity]))
    // red connector labels are collected here and drawn in a final pass, on top
    // of every blue label AND the dots — the red strip highlight always wins
    const deferred_red: { text: string, x: number, y: number, alpha: number, align: 'left' | 'center' }[] = []

    // dict labels first (our content wins the collision contest); the strip's
    // connector dict renders red with an entry-count suffix, crossfading
    for (const [id, placed] of label_layout) {
      const pos = singles_pos[id]
      const dict = dict_by_id.get(id)
      if (!pos || !dict)
        continue
      const box = { x: pos.x + placed.dx, y: pos.y + placed.dy, width: placed.width, height: placed.height }
      placer.block(box)
      if (placed.leader)
        draw_leader({ dot: pos, box })
      const baseline_y = box.y + 10.5
      const alpha = connector_alpha.get(id) ?? 0
      if (alpha < 0.99)
        draw_plain_label({ text: dict.name, x: box.x, y: baseline_y, font: dict_font, fill: colors.dict_label, alpha: 1 - alpha })
      if (alpha > 0.01) {
        // reserve the wider red text (name + "· N entries") so nearby labels dodge it
        const text = connector_text(dict)
        placer.block({ x: box.x - 2, y: baseline_y - 11, width: measure(text, dict_font) + 4, height: 14 })
        deferred_red.push({ text, x: box.x, y: baseline_y, alpha, align: 'left' })
      }
    }

    // connector dict hidden inside a cluster (or no labels at this zoom yet) —
    // float its red label just above the dot/cluster the line points at
    for (const { dict_id, opacity } of connector_labels) {
      if (opacity <= 0.01 || (label_layout.has(dict_id) && singles_pos[dict_id]))
        continue
      const dict = dict_by_id.get(dict_id)
      if (!dict)
        continue
      const cluster = visible_clusters.find(candidate => candidate.items.some(item => item.id === dict_id))
      if (!cluster)
        continue
      const text = connector_text(dict)
      const text_width = measure(text, dict_font)
      const x = Math.max(text_width / 2 + 4, Math.min(width - text_width / 2 - 4, cluster.x))
      const y = cluster.y - 12
      placer.block({ x: x - text_width / 2, y: y - 11, width: text_width, height: LABEL_HEIGHT })
      deferred_red.push({ text, x, y, alpha: opacity, align: 'center' })
    }

    // country labels, progressively by size
    if (k >= 1.4 && k < 9) {
      const max_rank = (k - 1.1) * 26
      for (const [name, lng, lat, rank] of country_labels as [string, number, number, number][]) {
        if (rank > max_rank)
          continue
        const point = base_projection([lng, lat])
        if (!point)
          continue
        const [x, y] = screen_of(point[0], point[1])
        draw_label({ text: name, x, y, font: label_font, fill: colors.label, halo: colors.label_halo, placer, align: 'center' })
      }
    }

    // admin-1 / state / province labels
    if (k >= 4.5 && admin1_labels) {
      const max_scalerank = (k - 3) * 2
      for (const [name, lng, lat, scalerank] of admin1_labels) {
        if (scalerank > max_scalerank)
          continue
        const point = base_projection([lng, lat])
        if (!point)
          continue
        const [x, y] = screen_of(point[0], point[1])
        draw_label({ text: name, x, y, font: label_font, fill: colors.label, halo: colors.label_halo, placer, align: 'center' })
      }
    }

    // city dots + labels
    if (k >= 5.5 && city_labels) {
      const max_scalerank = k - 4.5
      for (const [name, lng, lat, scalerank, capital] of city_labels) {
        if (scalerank > max_scalerank && !capital)
          continue
        const point = base_projection([lng, lat])
        if (!point)
          continue
        const [x, y] = screen_of(point[0], point[1])
        if (x < -10 || x > width + 10 || y < -10 || y > height + 10)
          continue
        context.beginPath()
        context.arc(x, y, 1.8, 0, Math.PI * 2)
        context.fillStyle = colors.label
        context.fill()
        draw_label({ text: name, x: x + 5, y: y + 3.5, font: label_font, fill: colors.label, halo: colors.label_halo, placer })
      }
    }

    // dots on top of labels' halos
    for (const cluster of visible_clusters) {
      const radius = cluster.count > 1 ? Math.min(4 + cluster.count * 0.45, 10) : 3.5
      context.beginPath()
      context.arc(cluster.x, cluster.y, radius, 0, Math.PI * 2)
      context.fillStyle = colors.dot
      context.fill()
      context.strokeStyle = colors.dot_stroke
      context.lineWidth = 1.25
      context.stroke()
      if (cluster.count > 1 && k >= 1.5) {
        context.font = `700 9px ${font_family}`
        context.textAlign = 'center'
        context.fillStyle = colors.dot_stroke
        context.fillText(String(cluster.count), cluster.x, cluster.y + 3)
      }
    }

    // red connector label(s) last — always on top of blue labels + dots
    for (const red of deferred_red)
      draw_plain_label({ text: red.text, x: red.x, y: red.y, font: dict_font, fill: colors.highlight, alpha: red.alpha, align: red.align })

    // pulse ring for the highlighted / selected dictionary
    const pulse_dict = highlighted_dict_id
      ? located_dicts.find(dict => dict.id === highlighted_dict_id)
      : selected_dict
    if (pulse_dict?.lng !== null && pulse_dict?.lng !== undefined) {
      const point = project_point({ lng: pulse_dict.lng, lat: pulse_dict.lat })
      if (point) {
        if (reduced_motion) {
          context.beginPath()
          context.arc(point.x, point.y, 9, 0, Math.PI * 2)
          context.strokeStyle = colors.highlight
          context.lineWidth = 2
          context.stroke()
        } else {
          const phase = (performance.now() % 1400) / 1400
          context.beginPath()
          context.arc(point.x, point.y, 5 + phase * 12, 0, Math.PI * 2)
          context.strokeStyle = colors.highlight
          context.globalAlpha = (1 - phase) * 0.9
          context.lineWidth = 2
          context.stroke()
          context.globalAlpha = 1
          schedule_draw()
        }
        context.beginPath()
        context.arc(point.x, point.y, 4, 0, Math.PI * 2)
        context.fillStyle = colors.highlight
        context.fill()
      }
    }

    // keep popover glued to its dot
    if (selected_dict && selected_dict.lng !== null) {
      const point = project_point({ lng: selected_dict.lng, lat: selected_dict.lat })
      if (point)
        popover_position = { x: Math.max(110, Math.min(width - 110, point.x)), y: point.y, above: point.y > 150 }
    }

    canvas_ready = true
    on_view_change?.({ k, bbox: current_bbox() })
  }

  function flash_hint(kind: 'touch') {
    hint = kind
    if (hint_timeout)
      clearTimeout(hint_timeout)
    hint_timeout = setTimeout(() => hint = null, 1500)
  }

  function find_cluster(x: number, y: number): Cluster<MapDict> | null {
    let best: Cluster<MapDict> | null = null
    let best_distance = Infinity
    for (const cluster of visible_clusters) {
      const radius = cluster.count > 1 ? Math.min(4 + cluster.count * 0.45, 10) : 3.5
      const distance = Math.hypot(cluster.x - x, cluster.y - y)
      if (distance <= Math.max(14, radius + 6) && distance < best_distance) {
        best = cluster
        best_distance = distance
      }
    }
    return best
  }

  /** Screen point → [lng, lat] through the current transform + base projection. */
  function invert_screen(x: number, y: number): [number, number] | null {
    if (!base_projection)
      return null
    const inverted = base_projection.invert?.([(x - transform.x) / transform.k, (y - transform.y) / transform.k])
    return inverted && Number.isFinite(inverted[0]) && Number.isFinite(inverted[1]) ? inverted : null
  }

  function find_country_at(x: number, y: number): GeoJSON.Feature | null {
    const point = invert_screen(x, y)
    if (!point)
      return null
    for (const feature of country_features) {
      if (geoContains(feature as any, point))
        return feature
    }
    return null
  }

  /** Transform fitting a country's projected bounds (≈ country-level zoom). */
  function country_transform(feature: GeoJSON.Feature): ZoomTransform {
    const [[x0, y0], [x1, y1]] = geoPath(base_projection).bounds(feature as any)
    const box_width = Math.max(x1 - x0, 1)
    const box_height = Math.max(y1 - y0, 1)
    const k = Math.max(MIN_ZOOM, Math.min(Math.min(width / box_width, height / box_height) * 0.85, MAX_ZOOM))
    const center_x = (x0 + x1) / 2
    const center_y = (y0 + y1) / 2
    return zoomIdentity
      .translate(width / 2 - center_x * k, height / 2 - center_y * k)
      .scale(k)
  }

  /** Center on a screen point and zoom in a step — the closer-than-country level. */
  function zoom_toward({ x, y }: { x: number, y: number }) {
    if (transform.k >= MAX_ZOOM)
      return
    const base_x = (x - transform.x) / transform.k
    const base_y = (y - transform.y) / transform.k
    const new_k = Math.min(transform.k * 2.2, MAX_ZOOM)
    const new_transform = zoomIdentity
      .translate(width / 2 - base_x * new_k, height / 2 - base_y * new_k)
      .scale(new_k)
    select(canvas).transition().duration(400).call(zoom_behavior.transform, new_transform)
  }

  function on_click(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const cluster = find_cluster(x, y)

    // an individual dot → open its popover (unchanged behavior)
    if (cluster && cluster.count === 1) {
      const [only] = cluster.items
      selected_dict = only
      schedule_draw()
      return
    }

    // a grouping dot OR a bare country click → zoom to that country
    selected_dict = null
    const seed = cluster ? { x: cluster.x, y: cluster.y } : { x, y }
    const country = base_projection && find_country_at(seed.x, seed.y)
    if (country) {
      const new_transform = country_transform(country)
      // already at (or past) this country's fit — a still-grouped cluster gets a
      // third, closer zoom level instead of re-fitting the same country
      if (new_transform.k > transform.k * 1.15) {
        zoom_depth = 1
        select(canvas).transition().duration(500).call(zoom_behavior.transform, new_transform)
        return
      }
      if (cluster) {
        zoom_depth = 2 // level 3: clustering off, every dot named
        zoom_toward(seed)
        return
      }
      return
    }

    // cluster over water / unmatched border → gentle zoom toward the crowd
    if (cluster) {
      zoom_depth = zoom_depth >= 1 ? 2 : 1
      zoom_toward(seed)
    }
  }

  function on_pointermove(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    const cluster = find_cluster(event.clientX - rect.left, event.clientY - rect.top)
    hover_dot = !!cluster
    if (!cluster) {
      hover_tip = null
      return
    }
    const [top] = [...cluster.items].sort((a, b) => b.entry_count - a.entry_count)
    // the click popover already covers this dictionary
    if (cluster.count === 1 && selected_dict?.id === top.id) {
      hover_tip = null
      return
    }
    hover_tip = { x: Math.max(80, Math.min(width - 80, cluster.x)), y: cluster.y, count: cluster.count, dict: top }
  }

  function on_touchmove(event: TouchEvent) {
    if (event.touches.length === 1)
      flash_hint('touch')
  }

  export function reset_view() {
    selected_dict = null
    zoom_depth = 0
    select(canvas).transition().duration(450).call(zoom_behavior.transform, zoomIdentity)
  }

  onMount(() => {
    context = canvas.getContext('2d')

    // dev-only deterministic zoom hook for e2e (tree-shaken from prod builds)
    if (import.meta.env.DEV) {
      (window as unknown as { __ld_worldmap?: unknown }).__ld_worldmap = {
        zoom_to: ({ lng, lat, k, depth }: { lng: number, lat: number, k: number, depth?: number }) => {
          if (!base_projection)
            return
          const projected = base_projection([lng, lat])
          if (!projected)
            return
          if (depth !== undefined)
            zoom_depth = depth
          const next = zoomIdentity.translate(width / 2 - projected[0] * k, height / 2 - projected[1] * k).scale(k)
          select(canvas).transition().duration(400).call(zoom_behavior.transform, next)
        },
        state: () => ({ k: transform.k, depth: zoom_depth, labels: label_layout.size, merged: merged_ids.size, clusters: visible_clusters.length }),
        reset: () => reset_view(),
      }
    }
    font_family = getComputedStyle(document.body).fontFamily || 'sans-serif'
    reduced_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    colors = read_map_colors(swatches)

    zoom_behavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .filter((event: any) => {
        if (event.type === 'wheel')
          return false // wheel/scroll zoom disabled — zoom is tap-to-country only
        if (event.type === 'touchstart')
          return (event.touches?.length ?? 0) >= 2
        return !event.button
      })
      .on('zoom', (event) => {
        ({ transform } = event)
        zoom_level = transform.k
        last_transform_change = performance.now()
        hover_tip = null
        schedule_draw()
      })
    select(canvas).call(zoom_behavior)

    rebuild_geometry()

    // warm the zoom-tier data (hi-res coastline, admin1 + city labels) once the
    // browser is idle so a tap never waits — never competes with initial paint
    const idle = 'requestIdleCallback' in window
      ? (callback: () => void) => requestIdleCallback(callback, { timeout: 8000 })
      : (callback: () => void) => setTimeout(callback, 3500)
    idle(() => {
      load_hi_res()
      load_admin1()
      load_cities()
    })

    const resize_observer = new ResizeObserver(() => rebuild_geometry())
    resize_observer.observe(container)

    // theme flips (the <html> class toggle or a system scheme change) recolor the canvas
    const html_observer = new MutationObserver(() => {
      colors = read_map_colors(swatches)
      schedule_draw()
    })
    html_observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    const scheme_query = window.matchMedia('(prefers-color-scheme: dark)')
    const on_scheme_change = () => {
      colors = read_map_colors(swatches)
      schedule_draw()
    }
    scheme_query.addEventListener('change', on_scheme_change)

    return () => {
      resize_observer.disconnect()
      html_observer.disconnect()
      scheme_query.removeEventListener('change', on_scheme_change)
      if (hint_timeout)
        clearTimeout(hint_timeout)
      if (layout_retry_timeout)
        clearTimeout(layout_retry_timeout)
    }
  })

  $effect(() => {
    void highlighted_dict_id
    void connector_labels
    if (context)
      schedule_draw()
  })

  $effect(() => {
    void located_dicts
    if (context)
      rebuild_geometry()
  })
</script>

<div class="map" bind:this={container}>
  <svg
    class={['ssr-map', { hidden: canvas_ready }]}
    viewBox="0 0 {ssr_map.width} {ssr_map.height}"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true">
    <path class="ssr-land" d={ssr_map.land_d} />
    <path class="ssr-dots" d={ssr_map.dots_d} />
  </svg>

  <canvas
    bind:this={canvas}
    class={{ 'hover-dot': hover_dot }}
    onclick={on_click}
    onpointermove={on_pointermove}
    onpointerleave={() => { hover_dot = false; hover_tip = null }}
    ontouchmove={on_touchmove}></canvas>

  {#if hint}
    <div class="hint">{t('home_v2.map_hint_touch')}</div>
  {/if}

  {#if zoom_level > 1.02}
    <div class="controls">
      <button type="button" class="btn control" onclick={() => reset_view()} aria-label={t('home_v2.reset_view')}><IconMdiArrowCollapseAll /></button>
    </div>
  {/if}

  {#if hover_tip}
    <div class={['tooltip', { below: hover_tip.y < 60 }]} style="left: {hover_tip.x}px; top: {hover_tip.y}px">
      {#if hover_tip.count === 1}
        <span class="tooltip-name">{hover_tip.dict.name}</span>
        <span class="tooltip-detail">{hover_tip.dict.entry_count.toLocaleString(page.data.locale || 'en')} {t('home_v2.entries')}</span>
      {:else}
        <span class="tooltip-detail">{t('home_v2.map_cluster_tooltip', { values: { count: String(hover_tip.count) } })}</span>
      {/if}
    </div>
  {/if}

  {#if selected_dict}
    <div
      class={['popover', { below: !popover_position.above }]}
      style="left: {popover_position.x}px; top: {popover_position.y}px">
      <button type="button" class="popover-close" onclick={() => selected_dict = null} aria-label={t('misc.cancel')}>
        <IconMdiClose />
      </button>
      <div class="popover-name">{selected_dict.name}</div>
      {#if selected_dict.location}
        <div class="popover-location"><IconMdiMapMarker style="font-size: 0.8125rem" /> {selected_dict.location}</div>
      {/if}
      <div class="popover-count">{selected_dict.entry_count.toLocaleString(page.data.locale || 'en')} {t('home_v2.entries')}</div>
      <a class="btn-primary btn-sm popover-open" data-sveltekit-preload-data="tap" href="/{selected_dict.url}">{t('home.open_dictionary')}</a>
    </div>
  {/if}

  <!-- hidden swatches: browser resolves theme vars + color-mix to rgb for the canvas -->
  <div class="swatches" bind:this={swatches} aria-hidden="true">
    <div data-swatch="land"></div>
    <div data-swatch="border"></div>
    <div data-swatch="dot"></div>
    <div data-swatch="dot_stroke"></div>
    <div data-swatch="label"></div>
    <div data-swatch="label_halo"></div>
    <div data-swatch="dict_label"></div>
    <div data-swatch="highlight"></div>
  </div>
</div>

<style>
  .map {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--background);
  }

  .ssr-map {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transition: opacity 300ms;
  }

  .ssr-map.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .ssr-land {
    fill: color-mix(in srgb, var(--color) 13%, var(--background));
  }

  .ssr-dots {
    fill: var(--primary);
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    cursor: grab;
    touch-action: pan-x pan-y;
  }

  canvas:active {
    cursor: grabbing;
  }

  canvas.hover-dot {
    cursor: pointer;
  }

  .hint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 0.5rem 1rem;
    background: color-mix(in srgb, var(--color) 82%, transparent);
    color: var(--background);
    border-radius: 9999px;
    font-size: 0.875rem;
    pointer-events: none;
  }

  .controls {
    position: absolute;
    bottom: 0.75rem;
    right: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .control {
    padding: 0.5rem;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
  }

  .tooltip {
    position: absolute;
    transform: translate(-50%, calc(-100% - 12px));
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 15rem;
    padding: 0.3125rem 0.625rem;
    background: var(--background);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    box-shadow: 0 4px 14px rgb(0 0 0 / 0.18);
    pointer-events: none;
    white-space: nowrap;
    z-index: 15;
  }

  .tooltip.below {
    transform: translate(-50%, 12px);
  }

  .tooltip-name {
    font-weight: 700;
    font-size: 0.8125rem;
  }

  .tooltip-detail {
    font-size: 0.75rem;
    color: var(--color-secondary);
  }

  .popover {
    position: absolute;
    transform: translate(-50%, calc(-100% - 14px));
    width: 13.5rem;
    padding: 0.75rem;
    background: var(--background);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    box-shadow: 0 10px 28px rgb(0 0 0 / 0.22);
    z-index: 20;
  }

  .popover.below {
    transform: translate(-50%, 14px);
  }

  .popover-close {
    position: absolute;
    top: 0.375rem;
    right: 0.375rem;
    padding: 0.25rem;
    border: none;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
    border-radius: 9999px;
  }

  .popover-name {
    font-weight: 700;
    font-size: 0.9375rem;
    padding-right: 1.25rem;
  }

  .popover-location {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.25rem;
    font-size: 0.8125rem;
    color: var(--color-secondary);
  }

  .popover-count {
    margin-top: 0.125rem;
    font-size: 0.8125rem;
    color: var(--color-secondary);
    font-variant-numeric: tabular-nums;
  }

  .popover-open {
    margin-top: 0.625rem;
    width: 100%;
  }

  .swatches {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
  }

  .swatches [data-swatch='land'] { background-color: color-mix(in srgb, var(--color) 13%, var(--background)); }
  .swatches [data-swatch='border'] { background-color: var(--background); }
  .swatches [data-swatch='dot'] { background-color: var(--primary); }
  .swatches [data-swatch='dot_stroke'] { background-color: var(--background); }
  .swatches [data-swatch='label'] { background-color: color-mix(in srgb, var(--color) 72%, var(--background)); }
  .swatches [data-swatch='label_halo'] { background-color: color-mix(in srgb, var(--background) 88%, transparent); }
  .swatches [data-swatch='dict_label'] { background-color: color-mix(in srgb, var(--primary) 80%, var(--color)); }
  .swatches [data-swatch='highlight'] { background-color: light-dark(#dc2626, #f87171); }
</style>
