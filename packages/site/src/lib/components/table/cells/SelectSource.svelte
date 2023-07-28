<script lang="ts">
  import { t } from 'svelte-i18n';
  import { BadgeArray } from 'svelte-pieces';
  import { createEventDispatcher } from 'svelte';
  export let canEdit = false;
  export let value: string[];
  
  const dispatch = createEventDispatcher<{
    valueupdate: { field: string; newValue: string[] };
  }>();
</script>

<BadgeArray
  class="remove-button-mb"
  strings={value || []}
  {canEdit}
  promptMessage={$t('entry.sr')}
  addMessage={$t('misc.add', { default: 'Add' })}
  on:valueupdated={(e) => dispatch('valueupdate', { field: 'sr', newValue: e.detail })} />

<style>
  /* TODO: svelte-pieces needs updated to not always add margin around all sides of Add button */
  :global(.remove-button-mb button) {
    margin-bottom: 0 !important;
  }
</style>
