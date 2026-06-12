<script lang="ts">
  import { BadgeArray } from '$lib/svelte-pieces'
  import { page } from '$app/stores'

  interface Props {
    alternateNames: string[]
    on_update: (new_value: string[]) => void
  }

  const { alternateNames, on_update }: Props = $props()
</script>

<div class="section-title">
  {$page.data.t('create.alternate_names')}
</div>

<BadgeArray
  strings={alternateNames}
  canEdit
  promptMessage={$page.data.t('create.enter_alternate_name')}
  addMessage={$page.data.t('misc.add')}
  on_valueupdated={value => on_update(value)} />

<style>
  .section-title {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
    margin-bottom: 0.25rem;
  }
</style>
