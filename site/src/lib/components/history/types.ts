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
}

export interface HistoryUser {
  id: string
  name: string | null
  email: string | null
}

export interface HistoryResult {
  changes: HistoryChange[]
  users: Record<string, HistoryUser>
  cursor: number | null
}
