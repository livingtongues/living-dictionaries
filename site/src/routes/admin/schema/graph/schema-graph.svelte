<script lang="ts">
  /**
   * Schema graph view — xyflow + dagre. Heavy import (xyflow ~150KB), so this
   * file is only reached via dynamic import from +page.svelte (Graph tab only).
   *
   * Persistence: filter toggles + manually-hidden set + drag positions are all
   * keyed by `source_label` so each source keeps its own tidied arrangement.
   */
  import type { SchemaInfo } from '$lib/db/introspect'
  import type { Edge, Node, NodeTypes } from '@xyflow/svelte'
  import type { SavedPositions } from './build-graph.js'
  import IconMdiArrowLeft from '~icons/mdi/arrow-left'
  import IconMdiCardTextOutline from '~icons/mdi/card-text-outline'
  import {
    Background,
    Controls,
    MiniMap,
    Panel,
    SvelteFlow,
  } from '@xyflow/svelte'
  import { browser } from '$app/environment'
  import { PersistedState } from '$lib/svelte-pieces/persisted-state.svelte.js'
  import { untrack } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { build_focused_graph, build_graph } from './build-graph.js'
  import GraphToolbar from './graph-toolbar.svelte'
  import TableNode from './table-node.svelte'
  import '@xyflow/svelte/dist/style.css'

  interface Props {
    schema: SchemaInfo
    /** Called with a table name when the user clicks a node — page swaps to Cards. */
    on_node_jump?: (table_name: string) => void
  }

  const { schema, on_node_jump }: Props = $props()

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
    // Touch storage_key so this re-runs on source switch.
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

  // Focused-view state — when set, the graph collapses to "this table on the
  // left, its direct relations on the right". Filters/persistence are ignored
  // in this mode; the layout is hand-rolled and ephemeral.
  let focused_table_id = $state<string | null>(null)
  // Reset focus when schema/source changes — otherwise we'd be focusing a
  // table that may not exist in the new schema.
  $effect(() => {
    schema.source_label // tracked
    untrack(() => { focused_table_id = null })
  })

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

  // Hover state for highlighting incident edges/nodes.
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
      const edge = built.edges.find(e => e.id === hovered_edge_id)
      if (edge) {
        set.add(edge.source)
        set.add(edge.target)
      }
    }
    return set
  })

  const has_hover = $derived(hovered_node_id !== null || hovered_edge_id !== null)

  // Translate our pure build_graph output into xyflow's expected shapes,
  // overlaying hover-derived class/style. Typed as the base xyflow Node/Edge
  // (generic-data Record) — our GraphNodeData satisfies the constraint.
  const display_nodes = $derived.by<Node[]>(() => built.nodes.map(node => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
    width: node.width,
    height: node.height,
    class: has_hover && !incident_node_ids.has(node.id) ? 'graph-dim' : '',
  })))

  /**
   * Short glyph for ON DELETE actions on edges. Unicode chars (not class names)
   * because xyflow renders edge labels as raw SVG text, not HTML.
   */
  function on_delete_glyph(action: string): string | undefined {
    if (!action || action === 'NO ACTION') return undefined
    if (action === 'CASCADE') return '⤓'
    if (action === 'SET NULL') return '○'
    if (action === 'RESTRICT') return '⊘'
    if (action === 'SET DEFAULT') return '↺'
    return '?'
  }

  // Edge labels only show on hover. Use a short glyph + tooltip so they don't
  // clip behind adjacent nodes at narrow zoom levels.
  const display_edges = $derived.by<Edge[]>(() => built.edges.map((edge) => {
    const highlighted = incident_edge_ids.has(edge.id)
    const glyph = on_delete_glyph(edge.data.on_delete)
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'default',
      animated: highlighted,
      style: highlighted
        ? 'stroke: var(--primary); stroke-width: 2.5;'
        : has_hover
          ? 'stroke: var(--border-color); stroke-width: 1; opacity: 0.25;'
          : 'stroke: var(--color-secondary); stroke-width: 1;',
      label: highlighted && glyph ? glyph : undefined,
      labelStyle: 'font-size: 14px; fill: var(--color);',
      labelBgStyle: 'fill: var(--surface); stroke: var(--border-color);',
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
    }
  }))

  // xyflow drives drags by mutating its own internal node positions and emitting
  // them back on dragstop. Capture them into PersistedState.
  function on_drag_stop({ targetNode }: { targetNode: Node | null }) {
    if (!targetNode || !persisted) return
    persisted.value = {
      ...persisted.value,
      positions: {
        ...persisted.value.positions,
        [targetNode.id]: targetNode.position,
      },
    }
  }

  function on_node_click({ node }: { node: Node }) {
    if (focused_table_id) {
      // In focused mode: clicking a satellite re-focuses on it; clicking the
      // focused node itself is a no-op (use the "Open card" button instead).
      if (node.id !== focused_table_id)
        focused_table_id = node.id
    } else {
      // In normal mode: clicking a node enters focused view.
      focused_table_id = node.id
    }
  }

  function on_node_context_menu({ node, event }: { node: Node, event: MouseEvent }) {
    event.preventDefault()
    // In focused mode, hide doesn't apply — there's no persisted hidden-set
    // for the focused subview; just exit the mode instead of doing nothing.
    if (focused_table_id) return
    if (!persisted) return
    const next_hidden = Array.from(new Set([...persisted.value.hidden, node.id]))
    persisted.value = { ...persisted.value, hidden: next_hidden }
  }

  function exit_focus() {
    focused_table_id = null
  }

  function open_focused_card() {
    if (focused_table_id) on_node_jump?.(focused_table_id)
  }

  function show_all() {
    if (!persisted) return
    persisted.value = { ...persisted.value, hidden: [] }
  }

  function reset_layout() {
    if (!persisted) return
    persisted.value = { ...persisted.value, positions: {} }
  }

  function toggle_junctions() {
    if (!persisted) return
    persisted.value = { ...persisted.value, hide_junctions: !persisted.value.hide_junctions }
  }

  function toggle_system() {
    if (!persisted) return
    persisted.value = { ...persisted.value, hide_system: !persisted.value.hide_system }
  }

  const node_types: NodeTypes = { table: TableNode as never }
</script>

{#if browser && persisted}
  <div class="schema-graph-wrapper">
    {#key focused_table_id}
    <SvelteFlow
      nodes={display_nodes}
      edges={display_edges}
      nodeTypes={node_types}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      onnodeclick={on_node_click}
      onnodecontextmenu={on_node_context_menu}
      onnodedragstop={on_drag_stop}
      onnodepointerenter={({ node }) => hovered_node_id = node.id}
      onnodepointerleave={() => hovered_node_id = null}
      onedgepointerenter={({ edge }) => hovered_edge_id = edge.id}
      onedgepointerleave={() => hovered_edge_id = null}>
      <Background />
      <Controls />
      <MiniMap pannable zoomable />
      {#if focused_table_id}
        <Panel position="top-left">
          <div class="focus-bar">
            <button type="button" class="btn-ghost btn-sm" onclick={exit_focus}>
              <IconMdiArrowLeft style="margin-right: 0.25rem" />Back to full graph
            </button>
            <div class="focus-label">
              <span class="muted">Focused on </span>
              <span class="mono strong">{focused_table_id}</span>
            </div>
            <button type="button" class="btn-ghost btn-sm" onclick={open_focused_card}>
              <IconMdiCardTextOutline style="margin-right: 0.25rem" />Open card
            </button>
          </div>
        </Panel>
        <Panel position="bottom-left">
          <div class="hint">click a neighbor → focus on it</div>
        </Panel>
      {:else}
        <Panel position="top-right">
          <GraphToolbar
            hide_junctions={persisted.value.hide_junctions}
            hide_system={persisted.value.hide_system}
            hidden_count={built.hidden_count}
            visible_count={built.visible_count}
            on_toggle_junctions={toggle_junctions}
            on_toggle_system={toggle_system}
            on_show_all={show_all}
            on_reset_layout={reset_layout} />
        </Panel>
        <Panel position="bottom-left">
          <div class="hint">click → focus on table · right-click → hide · drag to arrange</div>
        </Panel>
      {/if}
    </SvelteFlow>
    {/key}
  </div>
{/if}

<style>
  .schema-graph-wrapper {
    width: 100%;
    height: 100%;
  }
  .focus-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    padding: 0.5rem;
  }
  .focus-label {
    font-size: 0.75rem;
  }
  .muted {
    color: var(--color-secondary);
  }
  .mono {
    font-family: var(--font-mono);
  }
  .strong {
    font-weight: 600;
    color: var(--color);
  }
  .hint {
    font-size: 10px;
    color: var(--color-secondary);
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
  }

  .schema-graph-wrapper :global(.graph-dim) {
    opacity: 0.3;
    transition: opacity 120ms;
  }
  .schema-graph-wrapper :global(.svelte-flow) {
    background: var(--background);
  }
  .schema-graph-wrapper :global(.svelte-flow__minimap) {
    background: var(--surface);
  }
  .schema-graph-wrapper :global(.svelte-flow__controls-button) {
    background: var(--surface);
    color: var(--color);
    border-color: var(--border-color);
  }
  .schema-graph-wrapper :global(.svelte-flow__controls-button:hover) {
    background: var(--background);
  }
</style>
