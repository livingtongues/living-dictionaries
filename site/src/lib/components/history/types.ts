export type HistoryOp = 'insert' | 'update' | 'delete'

export interface HistoryChange {
  id: string
  table_name: string
  row_id: string
  op: HistoryOp
  user_id: string
  at: string
  snapshot: Record<string, unknown> | null
  delta: Record<string, { old?: unknown, new?: unknown }> | null
  /** The acting agent's API key id; null = a human edited directly. */
  api_key_id: string | null
}

export interface HistoryUser {
  id: string
  name: string | null
  email: string | null
}

export interface HistoryApiKey {
  id: string
  label: string
  created_by_user_id: string | null
}

export type HistoryActor = 'all' | 'humans' | 'agents'

export interface HistoryResult {
  changes: HistoryChange[]
  users: Record<string, HistoryUser>
  api_keys: Record<string, HistoryApiKey>
  cursor: number | null
}
