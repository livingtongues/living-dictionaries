<script lang="ts">
  // Visual-verification wrapper for DictBootProgress (svelte-look only): the real
  // component reads a module store fed by the leader worker, so this drives that
  // store from props so each story flavor renders a distinct boot state.
  import DictBootProgress from './DictBootProgress.svelte'
  import { end_dict_boot_progress, report_dict_boot_failed, report_dict_boot_progress } from '$lib/db/dict-client/dict-boot-progress.svelte'

  interface Props {
    stage?: string
    received_bytes?: number
    total_bytes?: number | null
    /** Render the give-up state instead of a progress stage. */
    failed?: boolean
    /** Editors get the extra "this may discard unsaved work" warning. */
    has_editor_role?: boolean
  }
  const { stage = 'snapshot_fetch', received_bytes = 0, total_bytes = null, failed = false, has_editor_role = false }: Props = $props()

  end_dict_boot_progress('demo')
  if (failed) {
    report_dict_boot_failed({ dict_id: 'demo', boot_message: 'sqlite3_open_v2', last_stage: 'opfs_open', has_editor_role })
  } else {
    // Activation requires a snapshot_fetch tick first (the store gate).
    report_dict_boot_progress({ dict_id: 'demo', stage: 'snapshot_fetch', detail: { received_bytes, total_bytes: total_bytes ?? undefined } })
    if (stage !== 'snapshot_fetch')
      report_dict_boot_progress({ dict_id: 'demo', stage })
  }
</script>

<div style="height: {failed ? 340 : 120}px; background: var(--surface, #f8fafc);">
  <DictBootProgress />
</div>
