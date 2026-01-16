<script lang="ts">
  import type { GeoProjection } from 'd3'
  import { geoGraticule10, geoPath, geoOrthographic } from 'd3'
  import { getContext, onMount, onDestroy, type Snippet } from 'svelte'
  import * as topojson from 'topojson-client'
  import land110Json from './data/land-110m.json'
  import countries110Json from './data/countries-110m.json'
  import { CANVAS_CONTEXT_NAME } from './constants'

  interface Props {
    width?: number
    height?: number
    initial_longitude?: number
    initial_latitude?: number
    children?: Snippet<[{ projection: GeoProjection; is_moving: boolean }]>
  }

  let {
    width = 0,
    height = 0,
    initial_longitude = 0,
    initial_latitude = 20,
    children
  }: Props = $props()

  const sphere = { type: 'Sphere' }
  const { register, deregister, invalidate } = getContext<{
    register: (fn: (ctx: CanvasRenderingContext2D) => void) => void
    deregister: (fn: (ctx: CanvasRenderingContext2D) => void) => void
    invalidate: () => void
  }>(CANVAS_CONTEXT_NAME)

  // eslint-disable-next-line ts/no-explicit-any
  const land110 = topojson.feature(land110Json as any, (land110Json as any).objects.land)
  // eslint-disable-next-line ts/no-explicit-any
  const borders110 = topojson.mesh(
    countries110Json as any,
    (countries110Json as any).objects.countries,
    (a: any, b: any) => a !== b
  )

  let land50: any = null
  let borders50: any = null
  let is_moving = $state(false)
  let settle_timeout: ReturnType<typeof setTimeout> | null = null

  let land = $derived(is_moving || !land50 ? land110 : land50)
  let borders = $derived(is_moving || !borders50 ? borders110 : borders50)

  async function load_high_res_data() {
    const [land50Json, countries50Json] = await Promise.all([
      import('./data/land-50m.json').then(m => m.default),
      import('./data/countries-50m.json').then(m => m.default),
    ])

    land50 = topojson.feature(land50Json as any, (land50Json as any).objects.land)
    borders50 = topojson.mesh(
      countries50Json as any,
      (countries50Json as any).objects.countries,
      (a: any, b: any) => a !== b
    )
    invalidate()
  }

  export function on_move_start() {
    if (settle_timeout) {
      clearTimeout(settle_timeout)
      settle_timeout = null
    }
    is_moving = true
  }

  export function on_move_end() {
    if (settle_timeout) {
      clearTimeout(settle_timeout)
    }
    settle_timeout = setTimeout(() => {
      is_moving = false
      invalidate()
    }, 150)
  }

  export function rotate_to(longitude: number, latitude: number) {
    projection.rotate([-longitude, -latitude, 0])
    invalidate()
  }

  let projection = $derived(
    geoOrthographic()
      .fitExtent(
        [
          [-1, -1],
          [width + 1, height + 1]
        ],
        sphere as any
      )
      .clipExtent([
        [-1, -1],
        [width + 1, height + 1]
      ])
      .rotate([-initial_longitude, -initial_latitude])
  )

  function draw(context: CanvasRenderingContext2D) {
    const path = geoPath(projection, context).pointRadius(1.5)

    context.beginPath()
    path(geoGraticule10())
    context.lineWidth = 0.5
    context.strokeStyle = '#eee'
    context.stroke()

    context.beginPath()
    path(land as any)
    context.fillStyle = '#cdcdcd'
    context.fill()

    context.beginPath()
    path(borders as any)
    context.strokeStyle = '#fff'
    context.lineWidth = 0.5
    context.stroke()

    context.beginPath()
    path(sphere as any)
    context.lineWidth = 1
    context.strokeStyle = '#000'
    context.stroke()

    context.canvas.dispatchEvent(new CustomEvent('input'))
  }

  register(draw)

  onMount(() => {
    invalidate()
    load_high_res_data()
  })

  onDestroy(() => {
    deregister(draw)
  })

  onDestroy(invalidate)

  $effect(() => {
    width
    height
    invalidate()
  })
</script>

{@render children?.({ projection, is_moving })}
