<script lang="ts">
  import { t } from 'svelte-i18n';
  import { BadgeArray } from 'svelte-pieces';

  export let alternateNames: string[];

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    update: { alternateNames: string[] };
  }>();
</script>

<div class="text-sm font-medium text-gray-700 mb-1">
  {$t('create.alternate_names', { default: 'Alternate Names' })}
</div>
<BadgeArray
  strings={alternateNames}
  canEdit
  promptMessage={$t('create.enter_alternate_name', { default: 'Enter Alternate Name' })}
  addMessage={$t('misc.add', { default: 'Add' })}
  on:valueupdated={(e) => dispatch('update', { alternateNames: e.detail })} />
