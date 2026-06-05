// Orthography is owned by the per-dictionary catalog schema; re-export so there's
// a single shape (`{ name: string, bcp?, notes? }`).
export type { Orthography } from '$lib/db/schemas/shared.types'
