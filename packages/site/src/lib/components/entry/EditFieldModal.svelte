<script lang="ts">
  import { Modal } from 'svelte-pieces'
  import type { EntryFieldValue } from '@living-dictionaries/types'
  import EditField from './EditField.svelte'

  export let display: string
  export let value = ''
  export let field: EntryFieldValue
  export let bcp: string = undefined
  export let isSompeng = false
  export let addingLexeme = false
  export let on_update: (new_value: string) => void | Promise<void>
  export let on_close: () => void
</script>

<Modal
  noscroll
  class={field === 'phonetic' && 'wider-phonetic-modal'}
  {on_close}>
  <span slot="heading">{display}</span>
  <EditField {on_close} {on_update} {value} {field} {bcp} {isSompeng} {addingLexeme} />
</Modal>
