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
    id="public"
    type="checkbox"
    {checked}
    on:change={async (e) => {
      // @ts-ignore
      dispatch('changed', { checked: e.target.checked });
    }} />
  <label for="public" class="mx-2 block text-sm font-medium text-gray-700">
    {t ? $t('create.visible_to_public') : 'Visible to Public'}
  </label>
</div>
<div class="text-xs text-gray-600 mt-1">
  ({t
    ? $t('settings.public_private_meaning')
    : 'Public means anyone can see your dictionary which requires community consent. Private dictionaries are visible only to you and your collaborators.'})
</div>
