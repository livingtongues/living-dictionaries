<script lang="ts">
  import type { Sync } from './sync-engine.svelte.js'
  import { dev } from '$app/environment'
  // import { toast } from '$lib/svelte-pieces/toast'

  interface Props {
    sync: Sync
  }

  let { sync }: Props = $props()

  const status = $derived.by(() => {
    if (!navigator.onLine) {
      return 'offline'
    }
    if (sync.is_syncing) {
      return 'syncing'
    }
    if (sync.last_error) {
      return 'error'
    }
    if (sync.last_sync_result?.success) {
      return 'synced'
    }
    return 'idle'
  })
</script>

<div class="flex items-center">
  {#if status === 'syncing'}
    <button type="button" class="px-2 py-1 rounded hover:bg-gray-200">
      <span class="i-mdi:cloud-sync-outline" />
    </button>
  {:else if status === 'synced'}
    <button type="button" class="px-2 py-1 rounded hover:bg-gray-200" onclick={async () => await sync.sync_with_notice()}>
      <span class="i-mdi:cloud-check-outline" />
    </button>
  {:else if status === 'error'}
    <button type="button" class="px-2 py-1 rounded hover:bg-gray-200" onclick={() => console.error(sync.last_error)}>
      <span class="i-mdi:cloud-alert-outline text-red-600" />
    </button>
  {:else if status === 'offline'}
    <button type="button" class="px-2 py-1 rounded hover:bg-gray-200">
      <span class="i-mdi:cloud-off-outline" />
    </button>
  {:else}
    <button type="button" class="px-2 py-1 rounded hover:bg-gray-200" onclick={async () => await sync.sync_with_notice()}>
      <span class="i-mdi:cloud-outline" />
    </button>
  {/if}
</div>
