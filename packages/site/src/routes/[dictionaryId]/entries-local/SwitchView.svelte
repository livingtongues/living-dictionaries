<script lang="ts">
  import { page } from '$app/stores';
  import type { View } from '$lib/search/types';

  export let view: View
  export let can_print = false
</script>

<div
  class="flex md:p-1 border bg-gray-200 rounded-md text-gray-600
    font-medium text-xl md:text-sm">
  <button
    type="button"
    on:click={() => view = null}
    class="{!view ? 'bg-white shadow' : 'hover:bg-gray-100'}
      px-2 py-1 rounded">
    <i class="far fa-list" />
    <span class="hidden md:inline">
      {$page.data.t('entry.list')}
    </span>
  </button>
  <div class="hidden md:block w-1" />
  <button
    type="button"
    on:click={() => view = 'table'}
    class="{view === 'table' ? 'bg-white shadow' : 'hover:bg-gray-100'}
      px-2 py-1 rounded">
    <i class="fal fa-table" />
    <span class="hidden md:inline">
      {$page.data.t('entry.table')}
    </span>
  </button>
  <div class="hidden md:block w-1" />
  <button
    type="button"
    on:click={() => view = 'gallery'}
    class="{view === 'gallery'
      ? 'bg-white shadow'
      : 'hover:bg-gray-100'}
      px-2 py-1 rounded">
    <i class="fal fa-image" />
    <span class="hidden md:inline">
      {$page.data.t('entry.gallery')}
    </span>
  </button>
  {#if can_print}
    <button
      type="button"
      on:click={() => view = 'print'}
      class="{view === 'print'
        ? 'bg-white shadow'
        : 'hover:bg-gray-100'}
        px-2 py-1 rounded">
      <span class="i-fa-print" style="margin-top: -4px;" />
      <span class="hidden md:inline">
        {$page.data.t('entry.print')}
      </span>
    </button>
  {/if}
</div>
