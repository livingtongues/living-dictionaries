<script lang="ts">
  import type { EntryFieldValue } from '@living-dictionaries/types'
  import { ShowHide } from 'svelte-pieces'
  import sanitize from 'xss'

  export let value: string
  export let htmlValue: string = undefined
  export let field: EntryFieldValue
  export let bcp: string = undefined
  export let can_edit = false
  export let display: string
  export let on_update: (new_value: string) => void

  $: sanitizedHtml = sanitize(htmlValue || value) || ''
</script>

<ShowHide let:show let:toggle let:set>
  <div
    class:cursor-pointer={can_edit}
    class:italic={field === 'scientific_names' && !value?.includes('<i>')}
    class="h-full"
    style="padding: 0.1em 0.25em"
    on:click={() => set(can_edit)}>
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
</ShowHide>
