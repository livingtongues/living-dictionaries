/**
 * Boot download progress for the per-dict leader worker, surfaced to the boot UI
 * (`routes/DictBootProgress.svelte`, rendered in the ROOT layout as a global
 * fixed bar). The dict `+layout.ts` load no longer blocks on `open_dict` (nav is
 * instant; the shim's RPCs queue until the leader is ready), so this bar streams
 * the cold-boot snapshot download while the already-rendered dict page shows its
 * loading state.
 *
 * Only the leader tab's worker reports (followers reach a ready leader and never
 * spawn one), and only a COLD boot that actually downloads a snapshot activates
 * the bar: it turns on at the first `snapshot_fetch` tick, so a warm OPFS re-open,
 * a follower, or a MemoryVFS boot never flashes it. `total_bytes` is present on
 * the editor/VPS path (`x-db-bytes`) → determinate %; absent on public R2 →
 * indeterminate. Module-level rune state = one shared boot at a time (dict opens
 * are sequential in a tab).
 */

/**
 * The boot gave up (see `boot-give-up.ts`). Until 2026-08-03 there was no such
 * state: `dict-session.ts` logged `dict_boot_recovery_exhausted` and stopped, so
 * the visitor kept watching an indeterminate bar — nine and a half minutes of it
 * in the worst measured case. A failed boot must SAY it failed and offer the one
 * action that can help.
 */
export interface DictBootFailure {
  dict_id: string
  /** The worker's boot error message, e.g. `sqlite3_open_v2`. */
  boot_message: string
  /** Last boot phase reached — `opfs_open` in every failure of 2026-08-02. */
  last_stage: string | null
  /**
   * Editors are ASKED before their local copy is discarded (it may hold un-pushed
   * writes we cannot prove absent without opening the file); viewers are not,
   * because a viewer's copy is losslessly re-downloadable.
   */
  has_editor_role: boolean
}

interface DictBootProgressState {
  active: boolean
  dict_id: string | null
  stage: string
  received_bytes: number
  total_bytes: number | null
  failure: DictBootFailure | null
}

export const dict_boot_progress = $state<DictBootProgressState>({
  active: false,
  dict_id: null,
  stage: '',
  received_bytes: 0,
  total_bytes: null,
  failure: null,
})

export function report_dict_boot_progress({ dict_id, stage, detail }: {
  dict_id: string
  stage: string
  detail?: { received_bytes?: number, total_bytes?: number }
}): void {
  // Forward progress after a give-up means something is trying again (a manual
  // retry, another tab winning the election) — drop the failure panel.
  if (dict_boot_progress.failure?.dict_id === dict_id)
    dict_boot_progress.failure = null

  // Activate ONLY once a real snapshot download begins. Earlier/other phases on a
  // warm boot (probe → opfs_open → migrate, no fetch) must never reveal the bar.
  if (!dict_boot_progress.active && stage !== 'snapshot_fetch')
    return

  dict_boot_progress.active = true
  dict_boot_progress.dict_id = dict_id
  dict_boot_progress.stage = stage
  if (typeof detail?.received_bytes === 'number')
    dict_boot_progress.received_bytes = detail.received_bytes
  if (typeof detail?.total_bytes === 'number')
    dict_boot_progress.total_bytes = detail.total_bytes
}

/**
 * The boot ladder is spent — surface it. Shown even when the progress bar never
 * activated: a warm re-open that can't open its file never emits `snapshot_fetch`,
 * which is exactly the shape every 2026-08-02 failure had.
 */
export function report_dict_boot_failed(failure: DictBootFailure): void {
  dict_boot_progress.active = true
  dict_boot_progress.dict_id = failure.dict_id
  dict_boot_progress.failure = failure
}

/** Clear the bar once this dict's leader is ready (or its boot gave up). */
export function end_dict_boot_progress(dict_id: string): void {
  if (dict_boot_progress.dict_id && dict_boot_progress.dict_id !== dict_id)
    return
  dict_boot_progress.active = false
  dict_boot_progress.dict_id = null
  dict_boot_progress.stage = ''
  dict_boot_progress.received_bytes = 0
  dict_boot_progress.total_bytes = null
  dict_boot_progress.failure = null
}
