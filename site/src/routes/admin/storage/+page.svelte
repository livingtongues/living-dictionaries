<script lang="ts">
  import type { AdminStorageResponseBody } from '../../api/admin/storage/+server'
  import { api_admin_storage } from '$api/admin/storage/_call'
  import { onMount } from 'svelte'
  import StorageView from './StorageView.svelte'

  let data_state = $state<AdminStorageResponseBody | null>(null)
  let load_error = $state('')

  onMount(async () => {
    const { data, error } = await api_admin_storage()
    if (error) {
      load_error = error.message
      return
    }
    data_state = data
  })
</script>

<svelte:head><title>Storage · Admin</title></svelte:head>

<div class="page">
  {#if load_error}
    <div class="error">{load_error}</div>
  {:else if !data_state}
    <div class="loading">Loading…</div>
  {:else}
    <StorageView data={data_state} />
  {/if}
</div>

<style>
  .page {
    max-width: 1000px;
    margin: 0 auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .error {
    color: var(--danger);
  }

  .loading {
    color: var(--text-2);
    font-size: 0.875rem;
  }
</style>
