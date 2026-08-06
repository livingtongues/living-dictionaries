<script lang="ts">
  import type { EntryFieldValue } from '$lib/types'
  import EditField from './EditField.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'

  interface Props {
    display: string
    /** SQLite hands back NULL for an empty field — normalized below, never passed on raw. */
    value?: string | null
    field: EntryFieldValue
    bcp?: string
    isSompeng?: boolean
    addingLexeme?: boolean
    on_update: (new_value: string) => void | Promise<void>
    on_close: () => void
    /** Adds a "Save ↓" action (also Ctrl+Enter) that saves, closes, then continues editing the same field one row down. */
    on_save_next?: () => void
  }

  const {
    display,
    value = '',
    field,
    bcp = undefined,
    isSompeng = false,
    addingLexeme = false,
    on_update,
    on_close,
    on_save_next = undefined,
  }: Props = $props()
</script>

<Modal
  noscroll
  class={field === 'phonetic' && 'wider-phonetic-modal'}
  {on_close}>
  {#snippet heading()}
    <span>{display}</span>
  {/snippet}
  <EditField {on_close} {on_update} {on_save_next} value={value ?? ''} {field} {bcp} {isSompeng} {addingLexeme} />
</Modal>
