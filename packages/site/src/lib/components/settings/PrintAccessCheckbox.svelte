<script lang="ts">
  import { page } from '$app/stores';

  export let checked: boolean;

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    changed: { checked: boolean };
  }>();
</script>

<div class="flex items-center">
  <input
    id="print-access"
    type="checkbox"
    {checked}
    on:change={async (e) => {
      // @ts-ignore
      dispatch('changed', { checked: e.target.checked });
    }} />
  <label for="public" class="mx-2 block text-sm font-medium text-gray-700">
    {$page.data.t('create.print_access')}
  </label>
</div>
<div class="text-xs text-gray-600 mt-1">
  ({$page.data.t('settings.print_access_meaning')})
</div>
