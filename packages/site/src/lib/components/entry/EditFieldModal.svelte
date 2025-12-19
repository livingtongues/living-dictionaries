<script lang="ts">
  import { Modal } from 'svelte-pieces'
  import type { EntryFieldValue } from '@living-dictionaries/types'
  import EditField from './EditField.svelte'

  interface Props {
    display: string;
    value?: string;
    field: EntryFieldValue;
    bcp?: string;
    isSompeng?: boolean;
    addingLexeme?: boolean;
    on_update: (new_value: string) => void | Promise<void>;
    on_close: () => void;
  }

  let {
    display,
    value = '',
    field,
    bcp = undefined,
    isSompeng = false,
    addingLexeme = false,
    on_update,
    on_close
  }: Props = $props();
</script>

<Modal
  noscroll
  class={field === 'phonetic' && 'wider-phonetic-modal'}
  {on_close}>
  {#snippet heading()}
    <span >{display}</span>
  {/snippet}
  <EditField {on_close} {on_update} {value} {field} {bcp} {isSompeng} {addingLexeme} />
</Modal>
