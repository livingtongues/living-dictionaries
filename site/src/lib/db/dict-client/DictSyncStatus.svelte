<script lang="ts">
  import type { DictSyncStatus } from './dict-sync-status.svelte.js'
  import { pick_dict_sync_status } from './dict-sync-status.svelte.js'
  import { page } from '$app/state'
  import { toast } from '$lib/state/toast.svelte'
  import IconMdiCloudAlertOutline from '~icons/mdi/cloud-alert-outline'
  import IconMdiCloudCheckOutline from '~icons/mdi/cloud-check-outline'
  import IconMdiCloudOffOutline from '~icons/mdi/cloud-off-outline'
  import IconMdiCloudOutline from '~icons/mdi/cloud-outline'
  import IconMdiCloudSyncOutline from '~icons/mdi/cloud-sync-outline'

  interface Props {
    sync_status: DictSyncStatus
  }

  let { sync_status }: Props = $props()

  const status = $derived(pick_dict_sync_status({
    online: sync_status.online,
    busy: sync_status.busy,
    last_error: sync_status.last_error,
    last_sync_at: sync_status.last_sync_at,
  }))

  const label = $derived(page.data.t(`sync.${status}`))

  // Sits inside SideMenu's row-level `onclick={on_close}` (closes the mobile
  // slideover) and next to the "Entries" nav `<a>` — stop both so tapping the
  // cloud only triggers a sync, not a navigation or menu-close.
  async function on_click(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (sync_status.busy)
      return
    try {
      await sync_status.sync_now()
    } catch (err) {
      toast.error(page.data.t('sync.tap_failed', { values: { message: (err as Error).message } }))
    }
  }
</script>

<button
  type="button"
  class="btn-ghost sync-button"
  disabled={sync_status.busy}
  title={label}
  aria-label={label}
  onclick={on_click}>
  {#if status === 'syncing'}
    <IconMdiCloudSyncOutline class="icon-inline sync-icon syncing" />
  {:else if status === 'synced'}
    <IconMdiCloudCheckOutline class="icon-inline sync-icon" />
  {:else if status === 'error'}
    <IconMdiCloudAlertOutline class="icon-inline sync-icon" style="color: var(--danger)" />
  {:else if status === 'offline'}
    <IconMdiCloudOffOutline class="icon-inline sync-icon" />
  {:else}
    <IconMdiCloudOutline class="icon-inline sync-icon" />
  {/if}
</button>

<style>
  .sync-button {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    /* Fixed 24px square (box-sizing includes the .btn-ghost 1px border) so this
       button's height matches the row's text line-height exactly — otherwise the
       Entries row (the only nav row with a button in it) ends up a couple pixels
       taller than every other row and no longer lines up with them. */
    box-sizing: border-box;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    margin-right: 0.25rem;
    border-radius: 0.375rem;
  }

  .sync-button:disabled {
    cursor: default;
  }

  .sync-icon {
    font-size: 1rem;
  }

  .sync-icon.syncing {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
