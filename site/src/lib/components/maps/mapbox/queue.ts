import { writable } from 'svelte/store'
import type { Unsubscriber, Writable } from 'svelte/store'
import type { Map } from 'mapbox-gl'

/**
 * `command` is a method name on Mapbox's own `Map` object (`fitBounds`, `flyTo`,
 * `setCenter`, `setZoom`, `resize`) — vendor spelling, never snake_cased.
 */
export interface MapCommand {
  command: string
  params?: unknown[]
}

type CallableMap = Record<string, (...params: unknown[]) => void>

export class EventQueue {
  queue: Writable<MapCommand[]>
  unsubscribe: Unsubscriber | null
  started: boolean

  constructor() {
    this.queue = writable([])
    this.unsubscribe = null
    this.started = false
  }

  send({ command, params = [] }: MapCommand) {
    if (!command)
      return

    this.queue.update(pending => [...pending, { command, params }])
  }

  start(map: Map) {
    const callable_map = map as unknown as CallableMap
    this.unsubscribe = this.queue.subscribe((pending) => {
      while (pending.length) {
        const { command, params } = pending.shift()

        callable_map[command](...params)
      }
    })
    this.started = true
  }

  stop() {
    if (!this.started)
      return

    this.unsubscribe()
    this.queue = writable([])
    this.started = false
  }
}
