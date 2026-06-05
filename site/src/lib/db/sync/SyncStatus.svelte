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

<div class="sync-status">
  {#if status === 'syncing'}
    <a href="/sync" class="btn-ghost sync-link" aria-label="Syncing">
      <IconMdiCloudSyncOutline class="sync-icon syncing" />
    </a>
  {:else if status === 'synced'}
    <a href="/sync" class="btn-ghost sync-link" aria-label="Synced">
      <IconMdiCloudCheckOutline class="sync-icon" />
    </a>
  {:else if status === 'error'}
    <a href="/sync" class="btn-ghost sync-link" aria-label="Sync error">
      <IconMdiCloudAlertOutline class="sync-icon" style="color: var(--danger)" />
    </a>
  {:else if status === 'offline'}
    <a href="/sync" class="btn-ghost sync-link" aria-label="Offline">
      <IconMdiCloudOffOutline class="sync-icon" />
    </a>
  {:else}
    <a href="/sync" class="btn-ghost sync-link" aria-label="Sync status">
      <IconMdiCloudOutline class="sync-icon" />
    </a>
  {/if}
</div>

<style>
  .sync-status {
    display: flex;
    align-items: center;
  }

  .sync-link {
    padding: 0.5rem;
  }

  .sync-icon {
    font-size: 1.125rem;
  }

  .sync-icon.syncing {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
