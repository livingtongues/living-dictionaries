<script lang="ts">
  import { page } from '$app/state'
  import { BadgeArray } from '$lib/svelte-pieces'

  interface Props {
    can_edit?: boolean
    value: string[]
    on_update: (new_value: string[]) => void
  }

  let { can_edit = false, value, on_update }: Props = $props()
</script>

<div>
  <BadgeArray
    class="remove-button-mb"
    strings={value || []}
    canEdit={can_edit}
    promptMessage={page.data.t('entry_field.sources')}
    addMessage=""
    onvalueupdated={detail => on_update(detail)}>
    {#snippet add({ add })}

      <button type="button" onclick={add} class="opacity-40 p-0.5 text-left grow-1 hover:bg-gray-200 rounded">
        <span class="i-fa-solid-plus mb-1"></span>
        {page.data.t('misc.add')}
      </button>

    {/snippet}
  </BadgeArray>
</div>
