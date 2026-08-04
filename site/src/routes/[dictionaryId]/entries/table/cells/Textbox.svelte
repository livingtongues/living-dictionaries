<script lang="ts">
  import type { EntryFieldValue } from '$lib/types'
  import sanitize from 'xss'
  import { page } from '$app/state'
  import GlossedText from '$lib/corpus/GlossedText.svelte'
  import { column_run } from '../column-run.svelte'

  interface Props {
    value: string
    htmlValue?: string
    field: EntryFieldValue
    bcp?: string
    display: string
    on_update: (new_value: string) => void
    /** Light up the dictionary's glossing-abbreviation codes inside the value. */
    gloss_codes?: boolean
    /** Edit directly in the cell (plain-input fields with no Keyman/IPA keyboard need). */
    inline?: boolean
    /** Identity of this cell for column runs ("Save ↓" walking down a column). */
    run_cell_id?: string
    /** Identity of the same column's cell one row down; enables the modal's "Save ↓" action. */
    next_run_cell_id?: string
  }

  const {
    value,
    htmlValue = undefined,
    field,
    bcp = undefined,
    display,
    on_update,
    gloss_codes = false,
    inline = false,
    run_cell_id = undefined,
    next_run_cell_id = undefined,
  }: Props = $props()
  const { can_edit } = $derived(page.data)

  const sanitizedHtml = $derived(sanitize(htmlValue || value) || '')

  let editing = $state(false)
  let draft = $state('')
  let show_modal = $state(false)
  let cell_el: HTMLElement = $state()

  function start_inline_edit() {
    draft = value || ''
    editing = true
  }

  function commit() {
    editing = false
    const new_value = draft.trim()
    if (new_value === (value || '')) return
    on_update(new_value)
  }

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 5)
  }

  $effect(() => {
    if (!run_cell_id || column_run.target !== run_cell_id || !can_edit) return
    column_run.consume()
    cell_el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    if (inline) start_inline_edit()
    else show_modal = true
  })
</script>

{#if editing}
  <input
    class="inline-editor"
    type="text"
    use:autofocus
    bind:value={draft}
    onblur={commit}
    onkeydown={(event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commit()
        if ((event.ctrlKey || event.metaKey) && next_run_cell_id) column_run.request(next_run_cell_id)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        editing = false
      }
    }} />
{:else}
  <div
    bind:this={cell_el}
    class:editable={can_edit}
    class:italic={field === 'scientific_names' && !value?.includes('<i>')}
    class="textbox-cell"
    style="padding: 0.1em 0.25em"
    onclick={() => {
      if (!can_edit) return
      if (inline) start_inline_edit()
      else show_modal = true
    }}>
    {#if gloss_codes && value}
      <GlossedText text={value} />
    {:else}
      {@html sanitizedHtml}
    {/if}
    &nbsp;
  </div>

  {#if show_modal}
    {#await import('$lib/components/entry/EditFieldModal.svelte') then { default: EditFieldModal }}
      <EditFieldModal
        {on_update}
        {value}
        {field}
        {display}
        {bcp}
        on_save_next={next_run_cell_id ? () => column_run.request(next_run_cell_id) : undefined}
        on_close={() => show_modal = false} />
    {/await}
  {/if}
{/if}

<style>
  .textbox-cell {
    height: 100%;
    white-space: normal;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }

  .editable {
    cursor: pointer;
  }

  .italic {
    font-style: italic;
  }

  .inline-editor {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 0.1em 0.25em;
    border: none;
    outline: 2px solid var(--primary);
    outline-offset: -2px;
    background: var(--background);
    color: var(--color);
    font: inherit;
  }
</style>
