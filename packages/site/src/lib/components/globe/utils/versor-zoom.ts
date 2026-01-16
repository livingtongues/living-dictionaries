import type { Selection, ZoomBehavior } from 'd3'
import { mean, pointers, zoom, zoomIdentity } from 'd3'
import versor from 'versor'

type Cartesian = [number, number, number]
type Quaternion = [number, number, number, number]
type Rotation = [number, number, number]

interface VersorZoomOptions {
  scale?: number
  scale_extent?: [number, number]
  keep_equator_level?: boolean
  latitude_limit?: number
}

// eslint-disable-next-line ts/no-explicit-any
export function versor_zoom(projection: any, options: VersorZoomOptions = {}) {
  const {
    scale = projection._scale === undefined
      ? (projection._scale = projection.scale())
      : projection._scale,
    scale_extent = [0.8, 8] as [number, number],
    keep_equator_level = false,
    latitude_limit = 81,
  } = options
  let v0: Cartesian, q0: Quaternion, r0: Rotation, a0: number, tl: number

  const zoomer: ZoomBehavior<Element, unknown> = zoom<Element, unknown>()
    .scaleExtent(scale_extent.map(x => x * scale) as [number, number])
    .on('start', zoomstarted)
    .on('zoom', zoomed)

  function point(event, that) {
    const t = pointers(event, that)

    if (t.length !== tl) {
      tl = t.length
      if (tl > 1) a0 = Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0])
      zoomstarted.call(that, event)
    }

    return tl > 1
      ? [
          mean(t, p => p[0]),
          mean(t, p => p[1]),
          Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]),
        ]
      : t[0]
  }

  function zoomstarted(event) {
    v0 = versor.cartesian(projection.invert(point(event, this)))
    q0 = versor((r0 = projection.rotate()))
  }

  function zoomed(event) {
    projection.scale(event.transform.k)
    const pt = point(event, this)
    const v1 = versor.cartesian(projection.rotate(r0).invert(pt))
    const delta = versor.delta(v0, v1)
    let q1 = versor.multiply(q0, delta)

    // For multitouch, compose with a rotation around the axis.
    if (pt[2]) {
      const d = (pt[2] - a0) / 2
      const s = -Math.sin(d)
      const c = Math.sign(Math.cos(d))
      q1 = versor.multiply([Math.sqrt(1 - s * s), 0, 0, c * s], q1)
    }

    let rotation = versor.rotation(q1)

    if (keep_equator_level) {
      rotation[1] = Math.max(-latitude_limit, Math.min(latitude_limit, rotation[1]))
      rotation[2] = 0
    }

    projection.rotate(rotation)

    // In vicinity of the antipode (unstable) of q0, restart.
    if (delta[0] < 0.7) zoomstarted.call(this, event)
  }

  // eslint-disable-next-line ts/no-explicit-any
  return Object.assign(
    (selection: Selection<Element, unknown, any, any>) =>
      selection
        .property('__zoom', zoomIdentity.scale(projection.scale()))
        .call(zoomer),
    {
      // eslint-disable-next-line ts/no-explicit-any
      on(type: string, listener?: (...args: any[]) => void) {
        if (listener !== undefined) {
          zoomer.on(type, listener)
          return this
        }
        return zoomer.on(type)
      },
    },
  )
}
