<script lang="ts">
import type { GeoProjection } from 'd3'
  import type { DictionaryView } from '@living-dictionaries/types'
  import { forceSimulation, forceX, forceY } from 'd3-force'
  import { getContext, onMount, onDestroy } from 'svelte'
  import { tweened } from 'svelte/motion'
  import { CANVAS_CONTEXT_NAME } from './constants'

  interface Props {
    projection: GeoProjection
    is_moving: boolean
    dictionaries: DictionaryView[]
    selected_dictionary_id?: string
    on_select?: (dictionary_id: string) => void
    type?: 'public' | 'private' | 'personal'
  }

  let {
    projection,
    is_moving,
    dictionaries = [],
    selected_dictionary_id = undefined,
    on_select,
    type = 'public'
  }: Props = $props()

  const { register, deregister, invalidate } = getContext<{
    register: (fn: (ctx: CanvasRenderingContext2D) => void) => void
    deregister: (fn: (ctx: CanvasRenderingContext2D) => void) => void
    invalidate: () => void
  }>(CANVAS_CONTEXT_NAME)

  interface DictionaryWithCoords {
    dictionary: DictionaryView
    longitude: number
    latitude: number
  }

  let dictionaries_with_coords = $derived(
    dictionaries
      .filter(d => d.coordinates?.points?.[0])
      .map(d => ({
        dictionary: d,
        longitude: d.coordinates!.points![0].coordinates.longitude,
        latitude: d.coordinates!.points![0].coordinates.latitude,
      }))
  )

  const dot_radius = 3
  const max_label_distance = 60
  const label_offset = 6

  const label_opacity = tweened(1, { duration: 100 })
  let cached_nodes: LabelNode[] = []

  $effect(() => {
    if (is_moving) {
      label_opacity.set(0, { duration: 0 })
    } else {
      cached_nodes = run_force_simulation(get_visible_points())
      label_opacity.set(1)
    }
  })

  interface LabelNode {
    dict_with_coords: DictionaryWithCoords
    dot_x: number
    dot_y: number
    x: number
    y: number
    width: number
    height: number
    font_size: number
    show_label: boolean
  }

  function get_color() {
    if (type === 'private') return '#000'
    if (type === 'personal') return '#2563eb'
    return '#546e7a'
  }

  function get_visible_points(): LabelNode[] {
    const nodes: LabelNode[] = []
    const font_size = type === 'private' ? 11 : type === 'personal' ? 13 : 12

    for (const dict_with_coords of dictionaries_with_coords) {
      const coords: [number, number] = [dict_with_coords.longitude, dict_with_coords.latitude]
      const projected = projection(coords)
      if (!projected) continue

      const [x, y] = projected
      const geo_distance = projection.rotate()
      const center_lon = -geo_distance[0]
      const center_lat = -geo_distance[1]

      // Check if point is on visible hemisphere
      const dist = Math.acos(
        Math.sin(dict_with_coords.latitude * Math.PI / 180) * Math.sin(center_lat * Math.PI / 180) +
        Math.cos(dict_with_coords.latitude * Math.PI / 180) * Math.cos(center_lat * Math.PI / 180) *
        Math.cos((dict_with_coords.longitude - center_lon) * Math.PI / 180)
      )
      if (dist > Math.PI / 2) continue

      const name = dict_with_coords.dictionary.name
      const width = name.length * font_size * 0.6
      const height = font_size

      nodes.push({
        dict_with_coords,
        dot_x: x,
        dot_y: y,
        x: x - width / 2,
        y: y - height - dot_radius - label_offset,
        width,
        height,
        font_size,
        show_label: true,
      })
    }
    return nodes
  }

  function force_rect_collide(padding = 2) {
    let nodes: LabelNode[] = []
    function force() {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          const overlap_x = (a.width + b.width) / 2 + padding - Math.abs((a.x + a.width / 2) - (b.x + b.width / 2))
          const overlap_y = (a.height + b.height) / 2 + padding - Math.abs((a.y + a.height / 2) - (b.y + b.height / 2))
          if (overlap_x > 0 && overlap_y > 0) {
            const move = Math.min(overlap_x, overlap_y) / 2 + 0.5
            if (overlap_x < overlap_y) {
              if (a.x < b.x) { a.x -= move; b.x += move }
              else { a.x += move; b.x -= move }
            } else {
              if (a.y < b.y) { a.y -= move; b.y += move }
              else { a.y += move; b.y -= move }
            }
          }
        }
      }
    }
    force.initialize = (n: LabelNode[]) => { nodes = n }
    return force
  }

  function run_force_simulation(nodes: LabelNode[]): LabelNode[] {
    if (nodes.length === 0) return nodes
    // eslint-disable-next-line ts/no-explicit-any
    const simulation = forceSimulation(nodes as any)
      .force('x', forceX((d: any) => d.dot_x - d.width / 2).strength(0.15))
      .force('y', forceY((d: any) => d.dot_y - d.height - dot_radius - label_offset).strength(0.15))
      .force('collide', force_rect_collide(4))
      .stop()
    for (let i = 0; i < 200; i++) {
      simulation.tick()
    }
    // Mark overlapping labels as hidden (keep first one that fits)
    mark_overlapping_labels(nodes)
    return nodes
  }

  function mark_overlapping_labels(nodes: LabelNode[]) {
    const padding = 3
    for (let i = 0; i < nodes.length; i++) {
      if (!nodes[i].show_label) continue
      for (let j = i + 1; j < nodes.length; j++) {
        if (!nodes[j].show_label) continue
        const a = nodes[i]
        const b = nodes[j]
        const overlap_x = (a.width + b.width) / 2 + padding - Math.abs((a.x + a.width / 2) - (b.x + b.width / 2))
        const overlap_y = (a.height + b.height) / 2 + padding - Math.abs((a.y + a.height / 2) - (b.y + b.height / 2))
        if (overlap_x > 0 && overlap_y > 0) {
          nodes[j].show_label = false
        }
      }
    }
  }

  function draw(context: CanvasRenderingContext2D) {
    const opacity = $label_opacity
    const nodes = is_moving ? get_visible_points() : cached_nodes
    const color = get_color()
    const is_selected_id = selected_dictionary_id

    for (const node of nodes) {
      const is_selected = node.dict_with_coords.dictionary.id === is_selected_id

      context.beginPath()
      context.arc(node.dot_x, node.dot_y, is_selected ? dot_radius + 2 : dot_radius, 0, 2 * Math.PI)
      context.fillStyle = is_selected ? '#2563eb' : color
      context.fill()

      if (opacity <= 0) continue
      if (!node.show_label) continue

      const label_center_x = node.x + node.width / 2
      const label_center_y = node.y + node.height / 2
      const default_x = node.dot_x - node.width / 2
      const default_y = node.dot_y - node.height - dot_radius - label_offset
      const dx = node.x - default_x
      const dy = node.y - default_y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > max_label_distance) continue

      if (distance > 5) {
        context.beginPath()
        context.moveTo(node.dot_x, node.dot_y)
        context.lineTo(label_center_x, label_center_y)
        context.strokeStyle = `rgba(0, 0, 0, ${0.3 * opacity})`
        context.lineWidth = 1
        context.stroke()
      }

      context.font = `${node.font_size}px sans-serif`
      context.fillStyle = is_selected ? `rgba(37, 99, 235, ${opacity})` : `rgba(51, 51, 51, ${opacity})`
      context.textAlign = 'center'
      context.fillText(node.dict_with_coords.dictionary.name, label_center_x, node.y + node.height)
    }
  }

  register(draw)

  onMount(() => {
    invalidate()
  })

  onDestroy(() => {
    deregister(draw)
  })

  onDestroy(invalidate)

  $effect(() => {
    projection
    $label_opacity
    selected_dictionary_id
    dictionaries
    invalidate()
  })
</script>
