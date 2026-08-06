<script lang="ts">
  import type { EntryFieldValue } from '$lib/types'
  import sanitize from 'xss'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import GlossedText from '$lib/corpus/GlossedText.svelte'
  import StruckText from '$lib/orthography/StruckText.svelte'

  interface Props {
    value: string
    htmlValue?: string
    field: EntryFieldValue
    bcp?: string
    display: string
    on_update: (new_value: string) => void
    /** Light up the dictionary's glossing-abbreviation codes inside the value. */
    gloss_codes?: boolean
  }

  const {
    value,
    htmlValue = undefined,
    field,
    bcp = undefined,
    display,
    on_update,
    gloss_codes = false,
  }: Props = $props()
  const { can_edit } = $derived(page.data)
</script>

<ShowHide>
  {#snippet children({ show, toggle, set })}
    <div
      class:editable={can_edit}
      class:italic={field === 'scientific_names' && !value?.includes('<i>')}
      class="textbox-cell"
      style="padding: 0.1em 0.25em"
      onclick={() => set(can_edit)}>
      {#if gloss_codes && value}
        <GlossedText text={value} />
      {:else if htmlValue}
        {@html sanitize(htmlValue)}
      {:else}
        <StruckText text={value || ''} />
      {/if}
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
