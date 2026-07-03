<script lang="ts">
  import type { Sync } from './engine.svelte.js'
  import IconMdiCloudAlertOutline from '~icons/mdi/cloud-alert-outline'
  import IconMdiCloudCheckOutline from '~icons/mdi/cloud-check-outline'
  import IconMdiCloudOffOutline from '~icons/mdi/cloud-off-outline'
  import IconMdiCloudOutline from '~icons/mdi/cloud-outline'
  import IconMdiCloudSyncOutline from '~icons/mdi/cloud-sync-outline'
  import { online } from 'svelte/reactivity/window'

  interface Props {
    sync: Sync
  }

  let { sync }: Props = $props()

  const status = $derived.by(() => {
    if (!online.current)
      return 'offline'
    if (sync.is_syncing)
      return 'syncing'
    if (sync.last_error)
      return 'error'
    if (sync.last_sync_result?.success)
      return 'synced'
    return 'idle'
  })
</script>

<!-- Bare status icon — nests inside the admin "Sync" nav tab (which links to
     /admin/sync); the tab supplies the label, click target + layout. -->
<span class="sync-status">
  {#if status === 'syncing'}
    <IconMdiCloudSyncOutline class="syncing" aria-label="Syncing" />
  {:else if status === 'synced'}
    <IconMdiCloudCheckOutline aria-label="Synced" />
  {:else if status === 'error'}
    <IconMdiCloudAlertOutline aria-label="Sync error" style="color: var(--danger)" />
  {:else if status === 'offline'}
    <IconMdiCloudOffOutline aria-label="Offline" />
  {:else}
    <IconMdiCloudOutline aria-label="Sync status" />
  {/if}
</span>

<style>
  .sync-status {
    display: inline-flex;
    align-items: center;
    font-size: 1.125rem;
  }

  .sync-status :global(.syncing) {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
