<script lang="ts">
  import type { GeoProjection } from 'd3'
  import { select, zoomIdentity } from 'd3'
  import { getContext } from 'svelte'
  import { versor_zoom } from './utils/versor-zoom'
  import { CANVAS_CONTEXT_NAME } from './constants'

  interface Props {
    context: CanvasRenderingContext2D
    projection: GeoProjection
    on_move_start?: () => void
    on_move_end?: () => void
  }

  let { context, projection, on_move_start, on_move_end }: Props = $props()

  let initial_scale: number | null = null

  const { invalidate } = getContext<{
    invalidate: () => void
  }>(CANVAS_CONTEXT_NAME)

  export function sync_transform(options: { zoom: number; center: [number, number] }) {
    if (!projection || !context || initial_scale === null) return
    const new_scale = options.zoom * initial_scale
    projection.scale(new_scale)
    projection.rotate([-options.center[0], -options.center[1], 0])
    select(context.canvas).property('__zoom', zoomIdentity.scale(new_scale))
    invalidate()
  }

  $effect(() => {
    if (projection && context) {
      if (initial_scale === null) {
        initial_scale = projection.scale()
      }

      const zoom_behavior = versor_zoom(projection, {
        scale_extent: [0.8, 200],
        keep_equator_level: true,
        latitude_limit: 81,
      })

      zoom_behavior.on('start.move', () => on_move_start?.())
      zoom_behavior.on('zoom.render', () => {
        invalidate()
      })
      zoom_behavior.on('end.move', () => on_move_end?.())

      select(context.canvas).call(zoom_behavior)
    }
  })
</script>
