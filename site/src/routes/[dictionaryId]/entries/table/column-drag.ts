import type { IColumn } from '$lib/types'

export const MIN_COLUMN_WIDTH = 31
export const MAX_COLUMN_WIDTH = 800

/** Which inter-column gap (0..cells.length) the pointer is over — gap i precedes column i. */
export function resolve_gap_index({ client_x, header_cells }: { client_x: number, header_cells: DOMRect[] }): number {
  for (let index = 0; index < header_cells.length; index++) {
    const rect = header_cells[index]
    if (client_x < rect.left + rect.width / 2) return index
  }
  return header_cells.length
}

/**
 * Reorder the PERSISTED base column list from a drag over the EXPANDED header row
 * (gloss/definition/example expand per-language — a group always moves as one base column).
 * The lexeme column is locked at position 0.
 */
export function apply_reorder({ preferred, expanded, dragged_field, gap_index }: {
  preferred: IColumn[]
  expanded: IColumn[]
  dragged_field: IColumn['field']
  gap_index: number
}) {
  const from = preferred.findIndex(column => column.field === dragged_field)
  if (from <= 0) return

  let to: number
  if (gap_index >= expanded.length) {
    to = preferred.length
  } else {
    const target_field = expanded[gap_index].field
    to = preferred.findIndex(column => column.field === target_field)
    if (to < 0) return
  }
  to = Math.max(1, to)
  if (to === from || to === from + 1) return

  const [moved] = preferred.splice(from, 1)
  preferred.splice(to > from ? to - 1 : to, 0, moved)
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest

  const make = (fields: string[]) => fields.map(field => ({ field, width: 100 })) as IColumn[]

  describe(resolve_gap_index, () => {
    const header_cells = [
      { left: 0, width: 100 },
      { left: 100, width: 100 },
      { left: 200, width: 100 },
    ] as DOMRect[]

    it('maps pointer x to the nearest gap', () => {
      expect(resolve_gap_index({ client_x: 10, header_cells })).toBe(0)
      expect(resolve_gap_index({ client_x: 149, header_cells })).toBe(1)
      expect(resolve_gap_index({ client_x: 151, header_cells })).toBe(2)
      expect(resolve_gap_index({ client_x: 400, header_cells })).toBe(3)
    })
  })

  describe(apply_reorder, () => {
    it('moves a column right', () => {
      const preferred = make(['lexeme', 'audio', 'photo', 'gloss'])
      apply_reorder({ preferred, expanded: preferred, dragged_field: 'audio', gap_index: 4 })
      expect(preferred.map(column => column.field)).toEqual(['lexeme', 'photo', 'gloss', 'audio'])
    })

    it('moves a column left but never before lexeme', () => {
      const preferred = make(['lexeme', 'audio', 'photo', 'gloss'])
      apply_reorder({ preferred, expanded: preferred, dragged_field: 'gloss', gap_index: 0 })
      expect(preferred.map(column => column.field)).toEqual(['lexeme', 'gloss', 'audio', 'photo'])
    })

    it('treats a drop between two expansions of the same group as a no-op', () => {
      const preferred = make(['lexeme', 'gloss', 'photo'])
      const expanded = make(['lexeme', 'gloss', 'gloss', 'photo'])
      apply_reorder({ preferred, expanded, dragged_field: 'gloss', gap_index: 2 })
      expect(preferred.map(column => column.field)).toEqual(['lexeme', 'gloss', 'photo'])
    })

    it('maps a drop before a hidden-column boundary to the base index of the visible target', () => {
      const preferred = make(['lexeme', 'audio', 'hiddenish', 'photo', 'gloss'])
      const expanded = make(['lexeme', 'audio', 'photo', 'gloss']) // hiddenish filtered out
      apply_reorder({ preferred, expanded, dragged_field: 'gloss', gap_index: 2 })
      expect(preferred.map(column => column.field)).toEqual(['lexeme', 'audio', 'hiddenish', 'gloss', 'photo'])
    })

    it('never moves the lexeme column', () => {
      const preferred = make(['lexeme', 'audio'])
      apply_reorder({ preferred, expanded: preferred, dragged_field: 'lexeme', gap_index: 2 })
      expect(preferred.map(column => column.field)).toEqual(['lexeme', 'audio'])
    })
  })
}
