<script lang="ts">
  import { page } from '$app/stores'
  import type { View } from '$lib/search/types'

  interface Props {
    view: View;
    can_print?: boolean;
  }

  let { view = $bindable(), can_print = false }: Props = $props();
</script>

<div class="flex text-gray-600 font-medium text-sm">
  <button
    type="button"
    onclick={() => view = null}
    class:active={!view}>
    <span class="i-fa-solid-list -mt-1"></span>
    <span class="hidden md:inline">
      {$page.data.t('entry.list')}
    </span>
  </button>
  <div class="hidden md:block w-1"></div>
  <button
    type="button"
    onclick={() => view = 'table'}
    class:active={view === 'table'}>
    <span class="i-fa-table -mt-1"></span>
    <span class="hidden md:inline">
      {$page.data.t('entry.table')}
    </span>
  </button>
  <div class="hidden md:block w-1"></div>
  <button
    type="button"
    onclick={() => view = 'gallery'}
    class:active={view === 'gallery'}>
    <span class="i-ic-outline-image -mt-1 text-lg"></span>
    <span class="hidden md:inline">
      {$page.data.t('entry.gallery')}
    </span>
  </button>
  {#if can_print}
    <div class="hidden md:block w-1"></div>
    <button
      type="button"
      onclick={() => view = 'print'}
      class:active={view === 'print'}>
      <span class="i-fa-print -mt-1"></span>
      <span class="hidden md:inline">
        {$page.data.t('entry.print')}
      </span>
    </button>
  {/if}
</div>

<style>
  button {
    --at-apply: hover:bg-gray-100 px-2 py-2 rounded;
  }
  .active {
    --at-apply: bg-gray-200 border;
  }
</style>
