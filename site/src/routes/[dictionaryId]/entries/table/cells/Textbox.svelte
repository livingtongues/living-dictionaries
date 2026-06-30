<script lang="ts">
  import type { EntryFieldValue } from '$lib/types'
  import sanitize from 'xss'
  import { ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/state'

  interface Props {
    value: string
    htmlValue?: string
    field: EntryFieldValue
    bcp?: string
    display: string
    on_update: (new_value: string) => void
  }

  const {
    value,
    htmlValue = undefined,
    field,
    bcp = undefined,
    display,
    on_update,
  }: Props = $props()
  const { can_edit } = $derived(page.data)

  const sanitizedHtml = $derived(sanitize(htmlValue || value) || '')
</script>

<ShowHide>
  {#snippet children({ show, toggle, set })}
    <div
      class:editable={can_edit}
      class:italic={field === 'scientific_names' && !value?.includes('<i>')}
      class="textbox-cell"
      style="padding: 0.1em 0.25em"
      onclick={() => set(can_edit)}>
      {@html sanitizedHtml}
      &nbsp;
    </div>

    {#if show}
      {#await import('$lib/components/entry/EditFieldModal.svelte') then { default: EditFieldModal }}
        <EditFieldModal
          {on_update}
          {value}
          {field}
          {display}
          {bcp}
          on_close={toggle} />
      {/await}
    {/if}
  {/snippet}
</ShowHide>

<style>
  .textbox-cell {
    height: 100%;
  }

  .editable {
    cursor: pointer;
  }

  .italic {
    font-style: italic;
  }
</style>
