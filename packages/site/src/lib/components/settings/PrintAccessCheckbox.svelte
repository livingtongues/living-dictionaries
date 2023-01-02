<script lang="ts">
  import { t } from 'svelte-i18n';

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
    {t ? $t('create.print_access') : 'Allow Viewers to Print Dictionary'}
  </label>
</div>
<div class="text-xs text-gray-600 mt-1">
  ({t
    ? $t('settings.print_access_meaning')
    : 'This gives the public the ability to download and print this Living Dictionary as a .PDF'})
</div>
