import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@living-dictionaries/types'
import { dummy_dictionaries } from '$lib/mocks/dummy-dictionaries'
import { dummy_audio, dummy_audio_speakers, dummy_dialects, dummy_entries, dummy_entry_dialects, dummy_entry_tags, dummy_senses, dummy_speakers, dummy_tags } from '$lib/mocks/dummy-entries'
import { MOCK_MANAGED_DICTIONARY_ID, MOCK_USER_ID } from '$lib/mocks/mock-user'

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
  // vps-migration dev mock: the mock user manages one dictionary so `is_manager`/`can_edit`
  // resolve true and editor interactions can be tested (see mocks/mock-user.ts).
  dictionary_roles: [{ user_id: MOCK_USER_ID, dictionary_id: MOCK_MANAGED_DICTIONARY_ID, role: 'manager' }],
  // vps-migration M2b dev mock: dummy entries (+ senses, media, tags, dialects) for `achi` so the
  // search worker builds a non-empty index and the entries list / entry editor can be exercised.
  entries: dummy_entries as unknown as Row[],
  senses: dummy_senses as unknown as Row[],
  audio: dummy_audio as unknown as Row[],
  speakers: dummy_speakers as unknown as Row[],
  tags: dummy_tags as unknown as Row[],
  dialects: dummy_dialects as unknown as Row[],
  audio_speakers: dummy_audio_speakers as unknown as Row[],
  entry_tags: dummy_entry_tags as unknown as Row[],
  entry_dialects: dummy_entry_dialects as unknown as Row[],
}

const LOGGED_OUT = { data: { user: null, session: null }, error: null }
const SIGN_IN_STUBBED = {
  data: { user: null, session: null },
  error: { name: 'AuthApiError', message: 'Sign-in is stubbed (vps-migration M1)', status: 400 },
}

function noop() {
  // intentional no-op (stubbed realtime / unsubscribe)
}

type PendingWrite
  = | { kind: 'insert', values: Row[] }
    | { kind: 'upsert', values: Row[] }
    | { kind: 'update', values: Row }
    | { kind: 'delete' }

class StubQueryBuilder {
  private filters: Predicate[] = []
  private want_single = false
  private range_bounds: [number, number] | null = null
  private row_limit: number | null = null
  private pending_write: PendingWrite | null = null

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

  // Writes — vps-migration M2b: mutate the in-memory `dummy_data` so editor
  // interactions (edit field, add/delete sense, etc.) round-trip in dev. Returns
  // affected rows so `.select().single()` callers get their inserted/updated row.
  insert(values: Row | Row[]) {
    this.pending_write = { kind: 'insert', values: Array.isArray(values) ? values : [values] }
    return this
  }

  upsert(values: Row | Row[]) {
    this.pending_write = { kind: 'upsert', values: Array.isArray(values) ? values : [values] }
    return this
  }

  update(values: Row) {
    this.pending_write = { kind: 'update', values }
    return this
  }

  delete() {
    this.pending_write = { kind: 'delete' }
    return this
  }

  private matches(row: Row) {
    return this.filters.every(predicate => predicate(row))
  }

  private apply_write(): Row[] {
    const table_rows = (dummy_data[this.table] ||= [])
    const write = this.pending_write
    if (!write) return []

    if (write.kind === 'insert') {
      table_rows.push(...write.values)
      return write.values
    }
    if (write.kind === 'upsert') {
      for (const value of write.values) {
        const index = table_rows.findIndex(row => row.id != null && row.id === value.id)
        if (index >= 0)
          table_rows[index] = { ...table_rows[index], ...value }
        else
          table_rows.push(value)
      }
      return write.values
    }
    if (write.kind === 'update') {
      const affected: Row[] = []
      for (const row of table_rows) {
        if (this.matches(row)) {
          Object.assign(row, write.values)
          affected.push(row)
        }
      }
      return affected
    }
    // delete
    const affected = table_rows.filter(row => this.matches(row))
    dummy_data[this.table] = table_rows.filter(row => !this.matches(row))
    return affected
  }

  private resolve() {
    if (this.pending_write) {
      const affected = this.apply_write()
      return this.want_single ? { data: affected[0] ?? null, error: null } : { data: affected, error: null }
    }
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
