<script lang="ts">
  import { page } from '$app/stores';
  import { BadgeArray } from 'svelte-pieces';

  export let alternateNames: string[];

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    update: { alternateNames: string[] };
  }>();
</script>

<div class="text-sm font-medium text-gray-700 mb-1">
  {$page.data.t('create.alternate_names')}
</div>
<BadgeArray
  strings={alternateNames}
  canEdit
  promptMessage={$page.data.t('create.enter_alternate_name')}
  addMessage={$page.data.t('misc.add')}
  on:valueupdated={(e) => dispatch('update', { alternateNames: e.detail })} />
