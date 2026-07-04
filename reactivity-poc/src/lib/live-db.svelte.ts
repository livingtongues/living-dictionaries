import { tick } from 'svelte'

/**
 * A faithful miniature of living-dictionaries' `DictTableStore` +
 * `get_table_accessor` (site/src/lib/db/dict-client/dict-live-db.svelte.ts):
 *
 * - a "backend" (stand-in for the wa-sqlite worker) holding plain rows,
 *   queried asynchronously
 * - a per-table store with `$state` rows, lazily CREATED on first `.rows`
 *   access, that subscribes (via an `$effect` created inside the tracked read,
 *   the `#track()` pattern) and re-queries on change notifications
 * - in-place row reconciliation (splice/push, like `reconcile_rows`)
 *
 * `make_live_db({ hoist_creation })` toggles the ONE difference under test:
 *   false → the store object (and its `$state` fields) is constructed INSIDE
 *           whatever reaction first reads `.rows` — the current/broken way
 *   true  → construction is hoisted out of the reaction via `$effect.root`
 *           (`construct_outside_reaction`) — the fix
 *
 * Why that matters (svelte 5.56 internals): state created while a reaction is
 * running is recorded in `current_sources` (runtime.js `push_reaction_value`),
 * and `get()` refuses to register a dependency on any signal in that set
 * (runtime.js:540) — the guard that lets you mutate your own freshly-created
 * state without `state_unsafe_mutation`. Svelte's own `SvelteMap#source` docs
 * the same semantics. So a `$derived` that lazily constructs the store it
 * reads gets NO dependency edge and silently never re-runs.
 */

export interface Row extends Record<string, unknown> {
  id: string
  label: string
}

export class FakeBackend {
  #rows: Row[] = []
  #subscribers = new Set<() => void>()
  #next_id = 1

  /** Async query, like a worker RPC round-trip. Returns copies. */
  async query(): Promise<Row[]> {
    await new Promise(resolve => setTimeout(resolve, 30))
    return this.#rows.map(row => ({ ...row }))
  }

  insert(label: string): void {
    this.#rows.push({ id: String(this.#next_id++), label })
    for (const callback of this.#subscribers) callback()
  }

  remove_last(): void {
    this.#rows.pop()
    for (const callback of this.#subscribers) callback()
  }

  get size(): number {
    return this.#rows.length
  }

  subscribe(callback: () => void): () => void {
    this.#subscribers.add(callback)
    return () => this.#subscribers.delete(callback)
  }
}

class MimicTableStore {
  #rows = $state<Row[]>([])
  #loading = $state(true)
  #subscribers = 0
  #started = false
  #unsubscribe: (() => void) | null = null
  #backend: FakeBackend

  constructor(backend: FakeBackend) {
    this.#backend = backend
    if ((globalThis as Record<string, unknown>).__DEP_DEBUG)
      console.log('[store] constructed at', new Error().stack)
  }

  get rows(): Row[] { this.#track(); return this.#rows }
  get loading(): boolean { this.#track(); return this.#loading }

  // Same shape as DictTableStore#track: subscribe-on-read via an $effect
  // created inside the tracked read.
  #track() {
    if ($effect.tracking()) {
      $effect(() => {
        if (this.#subscribers === 0 && !this.#started)
          void this.#start()
        this.#subscribers++
        return () => {
          void tick().then(() => {
            this.#subscribers--
          })
        }
      })
    }
  }

  async #start() {
    console.log('[store] start')
    this.#started = true
    this.#loading = true
    await this.#refresh()
    this.#loading = false
    console.log('[store] loading -> false')
    this.#unsubscribe = this.#backend.subscribe(() => { void this.#refresh() })
  }

  // In-place reconcile, like reconcile_rows (mutates the $state array).
  async #refresh() {
    const fresh_rows = await this.#backend.query()
    console.log('[store] refreshed, fresh rows:', fresh_rows.length)
    const fresh_ids = new Set(fresh_rows.map(row => row.id))
    for (let index = this.#rows.length - 1; index >= 0; index--) {
      if (!fresh_ids.has(this.#rows[index].id))
        this.#rows.splice(index, 1)
    }
    const existing_ids = new Set(this.#rows.map(row => row.id))
    for (const row of fresh_rows) {
      if (!existing_ids.has(row.id))
        this.#rows.push(row)
    }
  }

  destroy() {
    this.#unsubscribe?.()
  }
}

const UNSET = Symbol('unset')

/**
 * Run `fn` OUTSIDE the currently-evaluating reaction so any `$state` it
 * creates is not swallowed by the reaction's `current_sources` dep-skip.
 * `$effect.root` runs its body synchronously with `active_reaction = null`
 * (and root effects are exempt from `derived.effects` teardown); we destroy
 * the root immediately — construction created no effects to keep. On the
 * server `$effect.root` compiles to a noop that never runs `fn`, hence the
 * sentinel fallback.
 */
export function construct_outside_reaction<T>(fn: () => T): T {
  let result: T | typeof UNSET = UNSET
  const destroy_root = $effect.root(() => {
    result = fn()
  })
  destroy_root()
  if (result === UNSET)
    result = fn()
  return result
}

export interface TableAccessor {
  readonly rows: Row[]
  readonly loading: boolean
}

export interface LiveDb {
  items: TableAccessor
  backend: FakeBackend
}

export function make_live_db({ hoist_creation }: { hoist_creation: boolean }): LiveDb {
  const backend = new FakeBackend()
  const stores = new Map<string, MimicTableStore>()

  function get_store(table_name: string): MimicTableStore {
    let store = stores.get(table_name)
    if (!store) {
      store = hoist_creation
        ? construct_outside_reaction(() => new MimicTableStore(backend))
        : new MimicTableStore(backend)
      stores.set(table_name, store)
    }
    return store
  }

  return {
    backend,
    items: {
      get rows(): Row[] { return get_store('items').rows },
      get loading(): boolean { return get_store('items').loading },
    },
  }
}
