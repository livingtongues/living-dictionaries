<script lang="ts">
  import { onMount, onDestroy, setContext, type Snippet } from 'svelte'
  import { scale_canvas } from './utils/scale-canvas'
  import { CANVAS_CONTEXT_NAME } from './constants'

  interface Props {
    width?: number
    height?: number
    center?: boolean
    children?: Snippet<[{ context: CanvasRenderingContext2D }]>
  }

  let {
    width = 0,
    height = 0,
    center = false,
    children
  }: Props = $props()

  const draw_functions: Array<(ctx: CanvasRenderingContext2D) => void> = []

  let canvas: HTMLCanvasElement
  let context = $state<CanvasRenderingContext2D | null>(null)
  let pending_invalidation = false
  let frame_id: number

  function update() {
    if (!context) return

    if (center) {
      context.clearRect(-width / 2, -height / 2, width, height)
    } else {
      context.clearRect(0, 0, width, height)
    }

    draw_functions.forEach((fn) => {
      context.save()
      fn(context)
      context.restore()
    })

    pending_invalidation = false
  }

  function invalidate() {
    if (pending_invalidation) return
    pending_invalidation = true
    frame_id = requestAnimationFrame(update)
  }

  setContext(CANVAS_CONTEXT_NAME, {
    register(fn: (ctx: CanvasRenderingContext2D) => void) {
      draw_functions.push(fn)
    },
    deregister(fn: (ctx: CanvasRenderingContext2D) => void) {
      draw_functions.splice(draw_functions.indexOf(fn), 1)
    },
    invalidate
  })

  onMount(() => {
    context = canvas.getContext('2d')!
  })

  onDestroy(() => {
    if (frame_id) {
      cancelAnimationFrame(frame_id)
    }
  })

  $effect(() => {
    if (canvas && context) {
      scale_canvas(canvas, context, width, height, center)
    }
  })
</script>

<canvas bind:this={canvas}></canvas>
{#if context}
  {@render children?.({ context })}
{/if}
