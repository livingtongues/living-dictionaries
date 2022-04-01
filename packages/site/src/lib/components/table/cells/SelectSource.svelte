<script lang="ts">
  import { _ } from 'svelte-i18n';
  import BadgeArray from 'svelte-pieces/data/BadgeArray.svelte';
  import { createEventDispatcher } from 'svelte';
  export let canEdit = false,
    value: string[];
  const dispatch = createEventDispatcher<{
    valueupdate: { field: string; newValue: string[] };
  }>();
</script>

<BadgeArray
  strings={value || []}
  {canEdit}
  promptMessage={$_('entry.sr')}
  addMessage={$_('misc.add', { default: 'Add' })}
  on:valueupdated={(e) => dispatch('valueupdate', { field: 'sr', newValue: e.detail })} />
