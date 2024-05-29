<script lang="ts">
  import { BadgeArray } from 'svelte-pieces'
  import { page } from '$app/stores'

  export let alternateNames: string[]
  export let on_update: (new_value: string[]) => void
  export let can_edit = false
</script>

{#if can_edit || alternateNames?.length > 0}
  <div class="text-sm font-medium text-gray-700 mb-1">
    {$page.data.t('create.alternate_names')}
  </div>
{/if}

{#if can_edit}
  <BadgeArray
    strings={alternateNames}
    canEdit
    promptMessage={$page.data.t('create.enter_alternate_name')}
    addMessage={$page.data.t('misc.add')}
    on:valueupdated={e => on_update(e.detail)} />
{:else}
  {alternateNames.join(', ')}
{/if}
