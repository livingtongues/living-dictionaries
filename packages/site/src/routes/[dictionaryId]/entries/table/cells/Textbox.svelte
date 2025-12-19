<script lang="ts">
  import type { EntryFieldValue } from '@living-dictionaries/types'
  import { ShowHide } from 'svelte-pieces'
  import sanitize from 'xss'
  import { page } from '$app/stores'

  interface Props {
    value: string;
    htmlValue?: string;
    field: EntryFieldValue;
    bcp?: string;
    display: string;
    on_update: (new_value: string) => void;
  }

  let {
    value,
    htmlValue = undefined,
    field,
    bcp = undefined,
    display,
    on_update
  }: Props = $props();
  let { can_edit } = $derived($page.data)

  let sanitizedHtml = $derived(sanitize(htmlValue || value) || '')
</script>

<ShowHide   >
  {#snippet children({ show, toggle, set })}
    <div
      class:cursor-pointer={$can_edit}
      class:italic={field === 'scientific_names' && !value?.includes('<i>')}
      class="h-full"
      style="padding: 0.1em 0.25em"
      onclick={() => set($can_edit)}>
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
