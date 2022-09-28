<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;

  export let checked: boolean;

  import { createEventDispatcher, tick } from 'svelte';
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
    <!-- {t ? $t('create.print_access') : 'Public Access to Print View'} -->
    Public Access to Print View
  </label>
</div>
<div class="text-xs text-gray-600 mt-1">
  <!-- ({t
    ? $t('settings.print_access_meaning')
    : 'Public access to print view means everybody can print the entries of the dictionary.'}) -->
    Public access to print view means everybody can print the entries of the dictionary.
</div>
