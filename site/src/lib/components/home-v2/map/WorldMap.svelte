<script lang="ts">
  import type { ZoomTransform } from 'd3'
  import type { MapDict } from '../types'
  import type { MapColors } from './theme-colors'
  import type { Cluster } from './view-helpers'
  import type { SsrMap } from './ssr-map'
  import { geoPath, select, zoom, zoomIdentity } from 'd3'
  import { onMount } from 'svelte'
  import * as topojson from 'topojson-client'
  import { page } from '$app/state'
  import countries110_topo from '$lib/components/globe/data/countries-110m.json'
  import land110_topo from '$lib/components/globe/data/land-110m.json'
  import country_labels from './data/country-labels.json'
  import { fit_equal_earth, MAX_ZOOM } from './projection'
  import { read_map_colors } from './theme-colors'
  import { cluster_points, create_label_placer, view_bbox } from './view-helpers'
  import IconMdiPlus from '~icons/mdi/plus'
  import IconMdiMinus from '~icons/mdi/minus'
  import IconMdiArrowCollapseAll from '~icons/mdi/arrow-collapse-all'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiMapMarker from '~icons/mdi/map-marker'

  export interface MapView {
    k: number
    bbox: { west: number, south: number, east: number, north: number } | null
  }

  interface Props {
    dicts: MapDict[]
    ssr_map: SsrMap
    highlighted_dict_id?: string | null
    on_view_change?: (view: MapView) => void
  }

  const { dicts, ssr_map, highlighted_dict_id = null, on_view_change }: Props = $props()
  const t = $derived(page.data.t)

  const located_dicts = $derived(dicts.filter(dict => dict.lat !== null && dict.lng !== null))

  let container: HTMLDivElement = $state()
  let canvas: HTMLCanvasElement = $state()
  let swatches: HTMLDivElement = $state()
  let canvas_ready = $state(false)
  let hint: 'wheel' | 'touch' | null = $state(null)
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
    const land = topojson.feature(land110_topo as any, (land110_topo as any).objects.land)
    const borders = topojson.mesh(countries110_topo as any, (countries110_topo as any).objects.countries, (a: any, b: any) => a !== b)
    land_path = new Path2D(path(land as any) ?? '')
    borders_path = new Path2D(path(borders as any) ?? '')
    schedule_draw()
  }

  async function load_hi_res() {
    if (hi_res || hi_res_loading || !base_projection)
      return
    hi_res_loading = true
    try {
      const [land50, countries50] = await Promise.all([
        import('$lib/components/globe/data/land-50m.json').then(module => module.default),
        import('$lib/components/globe/data/countries-50m.json').then(module => module.default),
      ])
      const path = geoPath(base_projection).digits(1)
      const land = topojson.feature(land50 as any, (land50 as any).objects.land)
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

  function draw() {
    if (!context || !base_projection || !land_path || !colors)
      return
    const { k, x: tx, y: ty } = transform

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, width, height)

    // land + borders (transformed base-space Path2D — no re-projection cost)
    context.setTransform(dpr * k, 0, 0, dpr * k, dpr * tx, dpr * ty)
    const active_land = hi_res?.land ?? land_path
    const active_borders = hi_res?.borders ?? borders_path
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

    // dictionary dots (clustered while zoomed out)
    const on_screen = []
    for (const dot of base_dots) {
      const [x, y] = screen_of(dot.x, dot.y)
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20)
        continue
      on_screen.push({ x, y, item: dot.dict })
    }
    visible_clusters = cluster_points({ points: on_screen, bin_size: k < 4 ? 14 : 7 })

    // dict labels first (our content wins the collision contest)
    if (k >= 3.5) {
      const singles = visible_clusters
        .filter(cluster => cluster.count === 1)
        .sort((a, b) => b.items[0].entry_count - a.items[0].entry_count)
        .slice(0, 60)
      for (const cluster of singles) {
        draw_label({
          text: cluster.items[0].name,
          x: cluster.x + 8,
          y: cluster.y + 4,
          font: dict_font,
          fill: colors.dict_label,
          halo: colors.label_halo,
          placer,
        })
      }
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

  function flash_hint(kind: 'wheel' | 'touch') {
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

  function on_click(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const cluster = find_cluster(x, y)
    if (!cluster) {
      selected_dict = null
      return
    }
    if (cluster.count > 1 && transform.k < MAX_ZOOM * 0.7) {
      // zoom toward the crowd instead of guessing which dot they meant
      const base_x = (cluster.x - transform.x) / transform.k
      const base_y = (cluster.y - transform.y) / transform.k
      const new_k = Math.min(transform.k * 2.2, MAX_ZOOM)
      const new_transform = zoomIdentity
        .translate(width / 2 - base_x * new_k, height / 2 - base_y * new_k)
        .scale(new_k)
      select(canvas).transition().duration(400).call(zoom_behavior.transform, new_transform)
      return
    }
    const [top] = [...cluster.items].sort((a, b) => b.entry_count - a.entry_count)
    selected_dict = top
    schedule_draw()
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

  function on_wheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey)
      flash_hint('wheel')
  }

  export function zoom_by(factor: number) {
    select(canvas).transition().duration(250).call(zoom_behavior.scaleBy, factor)
  }

  export function reset_view() {
    selected_dict = null
    select(canvas).transition().duration(450).call(zoom_behavior.transform, zoomIdentity)
  }

  onMount(() => {
    context = canvas.getContext('2d')
    font_family = getComputedStyle(document.body).fontFamily || 'sans-serif'
    reduced_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    colors = read_map_colors(swatches)

    zoom_behavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .filter((event: any) => {
        if (event.type === 'wheel')
          return event.ctrlKey || event.metaKey
        if (event.type === 'touchstart')
          return (event.touches?.length ?? 0) >= 2
        return !event.button
      })
      .on('zoom', (event) => {
        ({ transform } = event)
        hover_tip = null
        schedule_draw()
      })
    select(canvas).call(zoom_behavior)

    rebuild_geometry()

    const resize_observer = new ResizeObserver(() => rebuild_geometry())
    resize_observer.observe(container)

    // theme flips (body class toggle or system scheme change) recolor the canvas
    const body_observer = new MutationObserver(() => {
      colors = read_map_colors(swatches)
      schedule_draw()
    })
    body_observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    const scheme_query = window.matchMedia('(prefers-color-scheme: dark)')
    const on_scheme_change = () => {
      colors = read_map_colors(swatches)
      schedule_draw()
    }
    scheme_query.addEventListener('change', on_scheme_change)

    return () => {
      resize_observer.disconnect()
      body_observer.disconnect()
      scheme_query.removeEventListener('change', on_scheme_change)
      if (hint_timeout)
        clearTimeout(hint_timeout)
    }
  })

  $effect(() => {
    void highlighted_dict_id
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
    ontouchmove={on_touchmove}
    onwheel={on_wheel}></canvas>

  {#if hint}
    <div class="hint">{hint === 'wheel' ? t('home_v2.map_hint_wheel') : t('home_v2.map_hint_touch')}</div>
  {/if}

  <div class="controls">
    <button type="button" class="btn control" onclick={() => zoom_by(1.7)} aria-label={t('home_v2.zoom_in')}><IconMdiPlus /></button>
    <button type="button" class="btn control" onclick={() => zoom_by(1 / 1.7)} aria-label={t('home_v2.zoom_out')}><IconMdiMinus /></button>
    <button type="button" class="btn control" onclick={() => reset_view()} aria-label={t('home_v2.reset_view')}><IconMdiArrowCollapseAll /></button>
  </div>

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
