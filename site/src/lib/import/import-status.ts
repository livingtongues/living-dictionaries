/**
 * The four states an import conversation moves through, plus whose plate it is
 * sitting on. Derived — nothing new is stored — so a conversation can never
 * drift out of sync with its own questions/timestamps.
 */
export type ImportStatus = 'submitted' | 'in_progress' | 'waiting_on_manager' | 'resolved'

/** `team` = we owe the next move, `manager` = the dictionary manager does. */
export type ImportWaitingOn = 'team' | 'manager' | null

export function derive_import_status({ started_at, resolved_at, open_questions }: {
  started_at: string | null
  resolved_at: string | null
  open_questions: number
}): { status: ImportStatus, waiting_on: ImportWaitingOn } {
  if (resolved_at)
    return { status: 'resolved', waiting_on: null }
  if (!started_at)
    return { status: 'submitted', waiting_on: 'team' }
  if (open_questions > 0)
    return { status: 'waiting_on_manager', waiting_on: 'manager' }
  return { status: 'in_progress', waiting_on: 'team' }
}

/** Sort weight so the list can order by "how far along is this". */
export const IMPORT_STATUS_ORDER: Record<ImportStatus, number> = {
  submitted: 0,
  in_progress: 1,
  waiting_on_manager: 2,
  resolved: 3,
}

if (import.meta.vitest) {
  describe(derive_import_status, () => {
    it('is submitted until the team starts', () => {
      expect(derive_import_status({ started_at: null, resolved_at: null, open_questions: 0 }))
        .toEqual({ status: 'submitted', waiting_on: 'team' })
    })

    it('is in progress once started with nothing outstanding for the manager', () => {
      expect(derive_import_status({ started_at: '2026-07-01', resolved_at: null, open_questions: 0 }))
        .toEqual({ status: 'in_progress', waiting_on: 'team' })
    })

    it('waits on the manager while questions are open', () => {
      expect(derive_import_status({ started_at: '2026-07-01', resolved_at: null, open_questions: 3 }))
        .toEqual({ status: 'waiting_on_manager', waiting_on: 'manager' })
    })

    it('resolved wins over open questions and waits on nobody', () => {
      expect(derive_import_status({ started_at: '2026-07-01', resolved_at: '2026-07-05', open_questions: 3 }))
        .toEqual({ status: 'resolved', waiting_on: null })
    })
  })
}
