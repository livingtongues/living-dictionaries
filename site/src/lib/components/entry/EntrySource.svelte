<script lang="ts">
  import { BadgeArray } from '$lib/svelte-pieces'
  import { page } from '$app/state'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  interface Props {
    can_edit?: boolean
    value: string[]
    on_update: (new_value: string[]) => void
  }

  const { can_edit = false, value, on_update }: Props = $props()
</script>

<div>
  <BadgeArray
    class="remove-button-mb"
    strings={value || []}
    canEdit={can_edit}
    promptMessage={page.data.t('entry_field.sources')}
    addMessage=""
    on_valueupdated={value => on_update(value)}>
    {#snippet add({ add })}

      <button type="button" onclick={add} class="add-source">
        <IconFaSolidPlus class="icon-inline" style="margin-bottom: 0.25rem" />
        {page.data.t('misc.add')}
      </button>

    {/snippet}
  </BadgeArray>
</div>

<style>
  .add-source {
    opacity: 0.4;
    padding: 0.125rem;
    text-align: left;
    flex-grow: 1;
    border-radius: 0.25rem;
  }

  .add-source:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
  }
</style>
