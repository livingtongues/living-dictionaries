<script lang="ts">
  /**
   * Schema graph view — a hand-rolled pan/zoom canvas (no @xyflow/svelte). The
   * world layer is a single CSS transform (translate + scale); nodes are
   * absolutely-positioned cards inside it, edges an SVG drawn in world coords.
   * Everything paints from theme vars, so the graph follows light/dark.
   *
   * Layout still comes from `build_graph` (dagre) / `build_focused_graph`.
   *
   * Persistence: filter toggles + manually-hidden set + drag positions are keyed
   * by `source_label` so each of (Server / Local / Paste) keeps its arrangement.
   */
  import type { SchemaInfo } from '$lib/db/introspect'
  import type { GraphNode, SavedPositions } from './build-graph.js'
  import type { Viewport } from './graph-geometry.js'
  import IconMdiFitToPageOutline from '~icons/mdi/fit-to-page-outline'
  import IconMdiMinus from '~icons/mdi/minus'
  import IconMdiPlus from '~icons/mdi/plus'
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { PersistedState } from '$lib/state/persisted-state.svelte.js'
  import { untrack } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { build_focused_graph, build_graph } from './build-graph.js'
  import { edge_path, fit_view, on_delete_glyph, zoom_at_point } from './graph-geometry.js'
  import GraphToolbar from './graph-toolbar.svelte'
  import TableNode from './table-node.svelte'

  interface Props {
    schema: SchemaInfo
  }
  const { schema }: Props = $props()

  interface PersistedShape {
    positions: SavedPositions
    hidden: string[]
    hide_junctions: boolean
    hide_system: boolean
  }

  const storage_key = $derived(`schema_graph_v1:${schema.source_label}`)

  // PersistedState's value is initialized lazily via $effect — we re-derive it
  // when the source switches so the right slice of localStorage applies.
  let persisted = $state<PersistedState<PersistedShape> | null>(null)
  $effect(() => {
    const key = storage_key
    untrack(() => {
      persisted = new PersistedState<PersistedShape>(key, {
        positions: {},
        hidden: [],
        hide_junctions: false,
        hide_system: true,
      })
    })
  })

  // Focused view collapses to "this table on the left, its direct relations on
  // the right". It lives in the URL (`?table=`), so clicking a table is real
  // navigation — the browser back button returns to the previous view. Switching
  // source tabs clears `table` (in +page), so a focus never leaks across sources.
  const focused_table_id = $derived(page.url.searchParams.get('table'))
  function focus_table(table_name: string) {
    const url = new URL(page.url)
    url.searchParams.set('table', table_name)
    void goto(url, { keepFocus: true, noScroll: true })
  }

  const hidden_set = $derived(new Set(persisted?.value.hidden ?? []))
  const built = $derived(focused_table_id
    ? build_focused_graph(schema, focused_table_id)
    : build_graph(schema, {
      filters: {
        hide_junctions: persisted?.value.hide_junctions ?? false,
        hide_system: persisted?.value.hide_system ?? true,
        hidden: hidden_set,
      },
      saved_positions: persisted?.value.positions ?? {},
    }))

  const node_by_id = $derived(new Map(built.nodes.map(node => [node.id, node])))

  // ---- Viewport (pan/zoom) -------------------------------------------------
  let viewport = $state<Viewport>({ x: 0, y: 0, k: 1 })
  let canvas_el = $state<HTMLDivElement | null>(null)
  let canvas_width = $state(0)
  let canvas_height = $state(0)

  function rect_of(node: GraphNode) {
    return { x: node.position.x, y: node.position.y, width: node.width, height: node.height }
  }

  function fit() {
    if (!canvas_width || !canvas_height || built.nodes.length === 0) return
    viewport = fit_view({ rects: built.nodes.map(rect_of), canvas_width, canvas_height })
  }

  // Auto-fit on first paint + whenever the visible *set* changes — source switch,
  // focus enter/exit, OR a filter toggle (junctions/system) which can add or drop
  // many nodes. Without refitting on filter, the layout reflows out from under the
  // user's framing and the toggle "looks" like it did nothing. Drag/pan/zoom and
  // single right-click hides are excluded, so manual framing survives those.
  const fit_signal = $derived(
    `${schema.source_label}::${focused_table_id ?? ''}`
      + `::${persisted?.value.hide_junctions ?? false}::${persisted?.value.hide_system ?? true}`,
  )
  let last_fit_signal = ''
  $effect(() => {
    const signal = fit_signal
    const width = canvas_width
    const height = canvas_height
    if (!width || !height || built.nodes.length === 0) return
    if (signal === last_fit_signal) return
    untrack(() => {
      viewport = fit_view({ rects: built.nodes.map(rect_of), canvas_width: width, canvas_height: height })
      last_fit_signal = signal
    })
  })

  function on_wheel(event: WheelEvent) {
    event.preventDefault()
    const rect = canvas_el?.getBoundingClientRect()
    if (!rect) return
    const factor = Math.exp(-event.deltaY * 0.0015)
    viewport = zoom_at_point({ viewport, cx: event.clientX - rect.left, cy: event.clientY - rect.top, factor })
  }

  function zoom_by(factor: number) {
    viewport = zoom_at_point({ viewport, cx: canvas_width / 2, cy: canvas_height / 2, factor })
  }

  // ---- Panning the background ----------------------------------------------
  let panning = $state(false)
  let pan_start: { px: number, py: number, ox: number, oy: number } | null = null
  function on_canvas_pointerdown(event: PointerEvent) {
    if (event.button !== 0) return
    // A press on overlay UI (toolbar checkboxes, zoom controls, hints) must NOT
    // start a background pan — panning grabs pointer capture on the canvas, which
    // then swallows the control's click so it never registers. Bug that made the
    // visibility toggles appear dead. Let those events fall through to the control.
    if ((event.target as Element).closest('.controls, .panel')) return
    panning = true
    pan_start = { px: event.clientX, py: event.clientY, ox: viewport.x, oy: viewport.y }
    canvas_el?.setPointerCapture(event.pointerId)
  }
  function on_canvas_pointermove(event: PointerEvent) {
    if (!panning || !pan_start) return
    viewport = { ...viewport, x: pan_start.ox + (event.clientX - pan_start.px), y: pan_start.oy + (event.clientY - pan_start.py) }
  }
  function on_canvas_pointerup(event: PointerEvent) {
    if (!panning) return
    panning = false
    pan_start = null
    try { canvas_el?.releasePointerCapture(event.pointerId) } catch { /* not captured */ }
  }

  // ---- Dragging a node ------------------------------------------------------
  // `drag` holds the live (uncommitted) position so we don't write to
  // PersistedState on every pointermove; commit happens on pointerup. Drag is
  // tracked via window listeners (not pointer capture) so a plain click still
  // fires a native `click` event — which is what drives focus, below.
  let drag = $state<{ id: string, x: number, y: number, moved: boolean } | null>(null)
  let drag_start: { px: number, py: number, nx: number, ny: number } | null = null
  // Set when a drag actually moved, so the trailing native `click` is ignored.
  let suppress_click = false

  function node_position(node: GraphNode) {
    return drag && drag.id === node.id ? { x: drag.x, y: drag.y } : node.position
  }

  function on_node_pointerdown(event: PointerEvent, node: GraphNode) {
    if (event.button !== 0) return
    event.stopPropagation() // don't also pan the background
    suppress_click = false
    drag = { id: node.id, x: node.position.x, y: node.position.y, moved: false }
    drag_start = { px: event.clientX, py: event.clientY, nx: node.position.x, ny: node.position.y }
    window.addEventListener('pointermove', on_window_pointermove)
    window.addEventListener('pointerup', on_window_pointerup)
  }
  function on_window_pointermove(event: PointerEvent) {
    if (!drag || !drag_start) return
    const moved = Math.abs(event.clientX - drag_start.px) > 3 || Math.abs(event.clientY - drag_start.py) > 3
    drag = {
      id: drag.id,
      x: drag_start.nx + (event.clientX - drag_start.px) / viewport.k,
      y: drag_start.ny + (event.clientY - drag_start.py) / viewport.k,
      moved: drag.moved || moved,
    }
  }
  function on_window_pointerup() {
    window.removeEventListener('pointermove', on_window_pointermove)
    window.removeEventListener('pointerup', on_window_pointerup)
    const finished = drag
    drag = null
    drag_start = null
    if (!finished?.moved) return
    suppress_click = true // a real drag — swallow the click that follows
    // Commit a real drag — but only in full-graph mode (focused layout is ephemeral).
    if (!focused_table_id && persisted)
      persisted.value = { ...persisted.value, positions: { ...persisted.value.positions, [finished.id]: { x: finished.x, y: finished.y } } }
  }

  function on_node_click(node: GraphNode) {
    if (suppress_click) {
      suppress_click = false
      return
    }
    if (focused_table_id) {
      if (node.id !== focused_table_id) focus_table(node.id)
    } else {
      focus_table(node.id)
    }
  }
  function on_node_keydown(event: KeyboardEvent, node: GraphNode) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      on_node_click(node)
    }
  }

  function on_node_context_menu(event: MouseEvent, node: GraphNode) {
    event.preventDefault()
    if (focused_table_id || !persisted) return
    const next_hidden = Array.from(new Set([...persisted.value.hidden, node.id]))
    persisted.value = { ...persisted.value, hidden: next_hidden }
  }

  // ---- Hover highlighting ---------------------------------------------------
  let hovered_node_id = $state<string | null>(null)
  let hovered_edge_id = $state<string | null>(null)

  const incident_edge_ids = $derived.by(() => {
    const set = new SvelteSet<string>()
    if (hovered_node_id) {
      for (const edge of built.edges) {
        if (edge.source === hovered_node_id || edge.target === hovered_node_id)
          set.add(edge.id)
      }
    } else if (hovered_edge_id) {
      set.add(hovered_edge_id)
    }
    return set
  })

  const incident_node_ids = $derived.by(() => {
    const set = new SvelteSet<string>()
    if (hovered_node_id) {
      set.add(hovered_node_id)
      for (const edge of built.edges) {
        if (edge.source === hovered_node_id) set.add(edge.target)
        if (edge.target === hovered_node_id) set.add(edge.source)
      }
    } else if (hovered_edge_id) {
      const edge = built.edges.find(candidate => candidate.id === hovered_edge_id)
      if (edge) { set.add(edge.source); set.add(edge.target) }
    }
    return set
  })

  const has_hover = $derived(hovered_node_id !== null || hovered_edge_id !== null)

  // ---- Edge geometry --------------------------------------------------------
  interface DisplayEdge {
    id: string
    d: string
    highlighted: boolean
    dimmed: boolean
    glyph: string | null
    mid_x: number
    mid_y: number
  }
  const display_edges = $derived.by<DisplayEdge[]>(() => {
    const out: DisplayEdge[] = []
    for (const edge of built.edges) {
      const source = node_by_id.get(edge.source)
      const target = node_by_id.get(edge.target)
      if (!source || !target) continue
      const sp = node_position(source)
      const tp = node_position(target)
      const target_on_right = (tp.x + target.width / 2) >= (sp.x + source.width / 2)
      const sx = target_on_right ? sp.x + source.width : sp.x
      const tx = target_on_right ? tp.x : tp.x + target.width
      const sy = sp.y + source.height / 2
      const ty = tp.y + target.height / 2
      const highlighted = incident_edge_ids.has(edge.id)
      out.push({
        id: edge.id,
        d: edge_path({ sx, sy, tx, ty, s_dir: target_on_right ? 1 : -1, t_dir: target_on_right ? -1 : 1 }),
        highlighted,
        dimmed: has_hover && !highlighted,
        glyph: highlighted ? on_delete_glyph(edge.data.on_delete) : null,
        mid_x: (sx + tx) / 2,
        mid_y: (sy + ty) / 2,
      })
    }
    return out
  })

  // ---- Toolbar actions ------------------------------------------------------
  function show_all() {
    if (persisted) persisted.value = { ...persisted.value, hidden: [] }
  }
  function reset_layout() {
    if (persisted) persisted.value = { ...persisted.value, positions: {} }
  }
  function toggle_junctions() {
    if (persisted) persisted.value = { ...persisted.value, hide_junctions: !persisted.value.hide_junctions }
  }
  function toggle_system() {
    if (persisted) persisted.value = { ...persisted.value, hide_system: !persisted.value.hide_system }
  }
</script>

{#if browser && persisted}
  <div
    class="canvas"
    class:panning
    bind:this={canvas_el}
    bind:clientWidth={canvas_width}
    bind:clientHeight={canvas_height}
    style="--dot-x: {viewport.x}px; --dot-y: {viewport.y}px; --dot-size: {20 * viewport.k}px"
    role="application"
    tabindex="-1"
    onwheel={on_wheel}
    onpointerdown={on_canvas_pointerdown}
    onpointermove={on_canvas_pointermove}
    onpointerup={on_canvas_pointerup}>

    <div class="world" style="transform: translate({viewport.x}px, {viewport.y}px) scale({viewport.k})">
      <svg class="edges" width="1" height="1" aria-hidden="true">
        {#each display_edges as edge (edge.id)}
          <path
            class="edge-hit"
            d={edge.d}
            vector-effect="non-scaling-stroke"
            onpointerenter={() => hovered_edge_id = edge.id}
            onpointerleave={() => hovered_edge_id = null} />
          <path
            class={['edge', { highlighted: edge.highlighted, dimmed: edge.dimmed }]}
            d={edge.d}
            vector-effect="non-scaling-stroke" />
        {/each}
      </svg>

      {#each built.nodes as node (node.id)}
        {@const pos = node_position(node)}
        <div
          class={['node', { dim: has_hover && !incident_node_ids.has(node.id) }]}
          style="left: {pos.x}px; top: {pos.y}px; width: {node.width}px"
          role="button"
          tabindex="-1"
          onpointerdown={event => on_node_pointerdown(event, node)}
          onclick={() => on_node_click(node)}
          onkeydown={event => on_node_keydown(event, node)}
          oncontextmenu={event => on_node_context_menu(event, node)}
          onpointerenter={() => hovered_node_id = node.id}
          onpointerleave={() => hovered_node_id = null}>
          <TableNode table={node.data.table} kind={node.data.kind} selected={node.id === focused_table_id} />
        </div>
      {/each}
    </div>

    <!-- Edge labels live in screen space (crisp at any zoom). -->
    <div class="label-layer">
      {#each display_edges as edge (edge.id)}
        {#if edge.glyph}
          <div class="edge-label" style="left: {viewport.x + edge.mid_x * viewport.k}px; top: {viewport.y + edge.mid_y * viewport.k}px">{edge.glyph}</div>
        {/if}
      {/each}
    </div>

    <div class="controls">
      <button type="button" title="Zoom in" onclick={() => zoom_by(1.2)}><IconMdiPlus /></button>
      <button type="button" title="Zoom out" onclick={() => zoom_by(1 / 1.2)}><IconMdiMinus /></button>
      <button type="button" title="Fit to view" onclick={fit}><IconMdiFitToPageOutline /></button>
    </div>

    {#if focused_table_id}
      <div class="panel bottom-left">
        <div class="hint">click a neighbor → focus it · back to exit</div>
      </div>
    {:else}
      <div class="panel top-right">
        <GraphToolbar
          hide_junctions={persisted.value.hide_junctions}
          hide_system={persisted.value.hide_system}
          hidden_count={built.hidden_count}
          visible_count={built.visible_count}
          trigger_count={schema.triggers.length}
          on_toggle_junctions={toggle_junctions}
          on_toggle_system={toggle_system}
          on_show_all={show_all}
          on_reset_layout={reset_layout} />
      </div>
      <div class="panel bottom-left">
        <div class="hint">click → focus on table · right-click → hide · drag to arrange</div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .canvas {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--background);
    background-image: radial-gradient(circle, var(--border-color) 1.25px, transparent 1.25px);
    background-size: var(--dot-size) var(--dot-size);
    background-position: var(--dot-x) var(--dot-y);
    cursor: grab;
    touch-action: none;
  }
  .canvas.panning {
    cursor: grabbing;
  }

  .world {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
    will-change: transform;
  }

  .edges {
    position: absolute;
    top: 0;
    left: 0;
    overflow: visible;
    pointer-events: none;
  }
  .edge {
    fill: none;
    stroke: var(--color-secondary);
    stroke-width: 1.5;
    transition: stroke 120ms, opacity 120ms;
  }
  .edge.highlighted {
    stroke: var(--primary);
    stroke-width: 2.5;
  }
  .edge.dimmed {
    stroke: var(--border-color);
    opacity: 0.3;
  }
  .edge-hit {
    fill: none;
    stroke: transparent;
    stroke-width: 16;
    pointer-events: stroke;
    cursor: pointer;
  }

  .node {
    position: absolute;
    cursor: grab;
  }
  .node:active {
    cursor: grabbing;
  }
  .node.dim {
    opacity: 0.3;
    transition: opacity 120ms;
  }

  .label-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .edge-label {
    position: absolute;
    transform: translate(-50%, -50%);
    font-size: 13px;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 4px;
    background: var(--surface);
    border: 1px solid var(--border-color);
    color: var(--color);
  }

  .controls {
    position: absolute;
    left: 0.75rem;
    bottom: 0.75rem;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    overflow: hidden;
    background: var(--surface);
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.08);
  }
  .controls button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: none;
    background: var(--surface);
    color: var(--color);
    cursor: pointer;
    transition: background-color 0.15s;
  }
  .controls button:not(:last-child) {
    border-bottom: 1px solid var(--border-color);
  }
  .controls button:hover {
    background: var(--background);
  }

  .panel {
    position: absolute;
  }
  .panel.top-left {
    top: 0.75rem;
    left: 0.75rem;
  }
  .panel.top-right {
    top: 0.75rem;
    right: 0.75rem;
  }
  .panel.bottom-left {
    left: 3.25rem;
    bottom: 0.75rem;
  }

  .hint {
    font-size: 10px;
    color: var(--color-secondary);
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
  }
</style>
