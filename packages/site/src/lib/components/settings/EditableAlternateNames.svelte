<script lang="ts">
  import { BadgeArray } from '$lib/svelte-pieces'
  import { page } from '$app/stores'

  interface Props {
    alternateNames: string[];
    on_update: (new_value: string[]) => void;
  }

  let { alternateNames, on_update }: Props = $props();
</script>

<div class="text-sm font-medium text-gray-700 mb-1">
  {$page.data.t('create.alternate_names')}
</div>

<BadgeArray
  strings={alternateNames}
  canEdit
  promptMessage={$page.data.t('create.enter_alternate_name')}
  addMessage={$page.data.t('misc.add')}
  onvalueupdated={value => on_update(value)} />
