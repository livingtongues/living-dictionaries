import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@living-dictionaries/types'
import { dummy_dictionaries } from '$lib/mocks/dummy-dictionaries'

/**
 * vps-migration M1 stub. Replaces the real Supabase client so the app boots with
 * ZERO Supabase (no network, no env). A tiny in-memory query engine backs
 * `.from(table)` with dummy data (only the dictionary catalog views are
 * populated — everything else resolves to `[]`). Auth is logged-out; sign-in is a
 * no-op. Realtime/storage are no-ops. Delete this whole file in M4 when the real
 * SQLite read/write path lands.
 *
 * Keep it simple: it honors just enough filter operators (`eq/neq/is/in/gt/not`)
 * for the homepage public/private split and per-dictionary `eq('dictionary_id')`
 * queries to behave. Writes are accepted as no-ops (not reachable while logged out).
 */

type Row = Record<string, any>
type Predicate = (row: Row) => boolean

const dummy_data: Record<string, Row[]> = {
  dictionaries_view: dummy_dictionaries as unknown as Row[],
  materialized_dictionaries_view: dummy_dictionaries as unknown as Row[],
  materialized_admin_dictionaries_view: dummy_dictionaries as unknown as Row[],
  dictionaries: dummy_dictionaries as unknown as Row[],
}

const LOGGED_OUT = { data: { user: null, session: null }, error: null }
const SIGN_IN_STUBBED = {
  data: { user: null, session: null },
  error: { name: 'AuthApiError', message: 'Sign-in is stubbed (vps-migration M1)', status: 400 },
}

function noop() {
  // intentional no-op (stubbed realtime / unsubscribe)
}

class StubQueryBuilder {
  private filters: Predicate[] = []
  private want_single = false
  private range_bounds: [number, number] | null = null
  private row_limit: number | null = null

  constructor(private readonly table: string) {}

  // Reads ---------------------------------------------------------------
  select() {
    return this
  }

  order() {
    return this
  }

  filter() {
    return this
  }

  match(criteria: Row) {
    for (const [column, value] of Object.entries(criteria))
      this.filters.push(row => row[column] === value)
    return this
  }

  eq(column: string, value: any) {
    this.filters.push(row => row[column] === value)
    return this
  }

  neq(column: string, value: any) {
    this.filters.push(row => row[column] !== value)
    return this
  }

  in(column: string, values: any[]) {
    this.filters.push(row => values.includes(row[column]))
    return this
  }

  gt(column: string, value: any) {
    this.filters.push(row => row[column] > value)
    return this
  }

  gte(column: string, value: any) {
    this.filters.push(row => row[column] >= value)
    return this
  }

  lt(column: string, value: any) {
    this.filters.push(row => row[column] < value)
    return this
  }

  lte(column: string, value: any) {
    this.filters.push(row => row[column] <= value)
    return this
  }

  is(column: string, value: any) {
    this.filters.push(value === null ? row => row[column] == null : row => row[column] === value)
    return this
  }

  not(column: string, operator: string, value: any) {
    if (operator === 'is' && value === null)
      this.filters.push(row => row[column] != null)
    return this
  }

  limit(count: number) {
    this.row_limit = count
    return this
  }

  range(from: number, to: number) {
    this.range_bounds = [from, to]
    return this
  }

  single() {
    this.want_single = true
    return this
  }

  maybeSingle() {
    this.want_single = true
    return this
  }

  // Writes (no-ops while logged out) ------------------------------------
  insert() {
    return this
  }

  upsert() {
    return this
  }

  update() {
    return this
  }

  delete() {
    return this
  }

  private resolve() {
    let rows = (dummy_data[this.table] || []).slice()
    for (const predicate of this.filters)
      rows = rows.filter(predicate)
    if (this.range_bounds)
      rows = rows.slice(this.range_bounds[0], this.range_bounds[1] + 1)
    else if (this.row_limit != null)
      rows = rows.slice(0, this.row_limit)
    return this.want_single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null }
  }

  // Make the builder awaitable.
  then(on_fulfilled?: (value: any) => any, on_rejected?: (reason: any) => any) {
    return Promise.resolve(this.resolve()).then(on_fulfilled, on_rejected)
  }
}

const auth_admin = {
  createUser: () => Promise.resolve({ data: { user: null }, error: null }),
  deleteUser: () => Promise.resolve({ data: {}, error: null }),
  updateUserById: () => Promise.resolve({ data: { user: null }, error: null }),
  getUserById: () => Promise.resolve({ data: { user: null }, error: null }),
  listUsers: () => Promise.resolve({ data: { users: [] }, error: null }),
  generateLink: () => Promise.resolve({ data: {}, error: null }),
}

const auth = {
  setSession: () => Promise.resolve(LOGGED_OUT),
  getSession: () => Promise.resolve({ data: { session: null }, error: null }),
  getUser: () => Promise.resolve({ data: { user: null }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: noop } } }),
  signInWithIdToken: () => Promise.resolve(SIGN_IN_STUBBED),
  signInWithPassword: () => Promise.resolve(SIGN_IN_STUBBED),
  signInWithOtp: () => Promise.resolve(SIGN_IN_STUBBED),
  verifyOtp: () => Promise.resolve(SIGN_IN_STUBBED),
  updateUser: () => Promise.resolve({ data: { user: null }, error: null }),
  signOut: () => Promise.resolve({ error: null }),
  admin: auth_admin,
}

const storage_bucket = {
  upload: () => Promise.resolve({ data: null, error: null }),
  remove: () => Promise.resolve({ data: null, error: null }),
  getPublicUrl: () => ({ data: { publicUrl: '' } }),
  createSignedUrl: () => Promise.resolve({ data: { signedUrl: '' }, error: null }),
}

function create_channel() {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: noop,
  }
  return channel
}

export function create_stub_supabase_client(): SupabaseClient<Database> {
  const client = {
    from: (table: string) => new StubQueryBuilder(table),
    rpc: () => new StubQueryBuilder('__rpc__'),
    channel: create_channel,
    removeChannel: noop,
    auth,
    storage: { from: () => storage_bucket },
  }
  return client as unknown as SupabaseClient<Database>
}
