<script lang="ts">
  import type { Sync } from './engine.svelte.js'
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

<div class="flex items-center">
  {#if status === 'syncing'}
    <a href="/sync" class="btn-ghost p-2" aria-label="Syncing">
      <span class="i-mdi:cloud-sync-outline text-lg animate-pulse"></span>
    </a>
  {:else if status === 'synced'}
    <a href="/sync" class="btn-ghost p-2" aria-label="Synced">
      <span class="i-mdi:cloud-check-outline text-lg"></span>
    </a>
  {:else if status === 'error'}
    <a href="/sync" class="btn-ghost p-2" aria-label="Sync error">
      <span class="i-mdi:cloud-alert-outline text-lg text-[var(--danger)]"></span>
    </a>
  {:else if status === 'offline'}
    <a href="/sync" class="btn-ghost p-2" aria-label="Offline">
      <span class="i-mdi:cloud-off-outline text-lg"></span>
    </a>
  {:else}
    <a href="/sync" class="btn-ghost p-2" aria-label="Sync status">
      <span class="i-mdi:cloud-outline text-lg"></span>
    </a>
  {/if}
</div>
