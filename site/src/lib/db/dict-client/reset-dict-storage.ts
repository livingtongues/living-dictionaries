import { DICT_DB_OPFS_PREFIX } from '$lib/constants'
import { log_event } from '$lib/debug/remote-log'
import { destroy_dict_client } from './dict-session'
import { delete_opfs_db_file } from './worker/opfs-connection'

/**
 * Discard this device's local copy of a dictionary and reload so it re-downloads
 * from scratch. The action behind the boot-failure panel's "Reset and re-download"
 * button (`routes/DictBootProgress.svelte`).
 *
 * NOT lossless for an EDITOR: an un-openable file cannot be probed for un-pushed
 * writes (that check lives inside the file), which is why the UI asks an editor to
 * confirm and never runs this silently for them. For a viewer the local copy is
 * snapshot + server pulls only, so discarding it costs a download and nothing else.
 *
 * The leader worker is destroyed FIRST: it holds the OPFS sync-access-handle, and
 * a held handle makes `removeEntry` fail. Reload happens regardless — a fresh page
 * session restarts the boot ladder either way.
 */
export async function reset_dict_local_storage({ dict_id, reload = () => location.reload() }: {
  dict_id: string
  reload?: () => void
}): Promise<void> {
  log_event({ level: 'warn', message: 'dict_boot_manual_reset', context: { dict_id } })
  try {
    destroy_dict_client(dict_id)
    await delete_opfs_db_file({ path: `${DICT_DB_OPFS_PREFIX}${dict_id}.db` })
  } catch (error) {
    console.error('[reset-dict-storage] failed to drop the local copy:', error)
  }
  reload()
}
