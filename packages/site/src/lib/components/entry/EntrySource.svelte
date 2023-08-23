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

<div>
  <BadgeArray
    class="remove-button-mb"
    strings={value || []}
    {canEdit}
    promptMessage={$t('entry.sr')}
    addMessage=""
    on:valueupdated={(e) => dispatch('valueupdate', { field: 'sr', newValue: e.detail })}>
    <svelte:fragment slot="add" let:add>
      <button type="button" on:click={add} class="opacity-40 p-0.5 text-left grow-1 hover:bg-gray-200 rounded">
        <span class="i-fa-solid-plus mb-1" />
        {$t('misc.add', { default: 'Add' })}
      </button>
    </svelte:fragment>
  </BadgeArray>
</div>
