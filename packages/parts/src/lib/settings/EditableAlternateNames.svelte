<script lang="ts">
  import BadgeArray from 'svelte-pieces/data/BadgeArray.svelte';
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;
  export let alternateNames: string[];

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    update: { alternateNames: string[] };
  }>();
</script>

<div class="text-sm font-medium text-gray-700 mb-1">
  {t ? $t('create.alternate_names') : 'Alternate Names'}
</div>
<BadgeArray
  strings={alternateNames}
  canEdit
  promptMessage={t ? $t('create.enter_alternate_name') : 'Enter Alternate Name'}
  addMessage={t ? $t('misc.add') : 'Add'}
  on:valueupdated={(e) => dispatch('update', { alternateNames: e.detail })} />
