<script lang="ts">
  import { page } from '$app/stores';
  import { createEventDispatcher } from 'svelte';

  export let checked: boolean;

  const dispatch = createEventDispatcher<{ changed: { checked: boolean }}>();
</script>

<div class="flex items-center">
  <input
    id="public"
    type="checkbox"
    {checked}
    on:change={(e) => {
      // @ts-ignore
      dispatch('changed', { checked: e.target.checked });
    }} />
  <label for="public" class="mx-2 block text-sm font-medium text-gray-700">
    {$page.data.t('create.visible_to_public')}
  </label>
</div>
<div class="text-xs text-gray-600 mt-1">
  ({$page.data.t('settings.public_private_meaning')})
</div>
