<script lang="ts">
  import { BadgeArray } from 'svelte-pieces'
  import { page } from '$app/stores'

  export let can_edit = false
  export let value: string[]
  export let on_update: (new_value: string[]) => void
</script>

<div>
  <BadgeArray
    class="remove-button-mb"
    strings={value || []}
    canEdit={can_edit}
    promptMessage={$page.data.t('entry_field.sources')}
    addMessage=""
    on:valueupdated={({ detail }) => on_update(detail)}>
    <svelte:fragment slot="add" let:add>
      <button type="button" on:click={add} class="opacity-40 p-0.5 text-left grow-1 hover:bg-gray-200 rounded">
        <span class="i-fa-solid-plus mb-1" />
        {$page.data.t('misc.add')}
      </button>
    </svelte:fragment>
  </BadgeArray>
</div>
