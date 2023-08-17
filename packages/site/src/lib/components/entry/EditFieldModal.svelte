<script lang="ts">
  import { Modal } from 'svelte-pieces';
  import EditField from './EditField.svelte';
  import type { EntryFieldValue } from '@living-dictionaries/types';

  interface $$Events {
    update: CustomEvent<string>;
    close: CustomEvent<boolean>;
  }

  export let display: string;
  export let value = '';
  export let field: EntryFieldValue;
  export let bcp: string = undefined;
  export let isSompeng = false;
  export let addingLexeme = false;
</script>

<Modal noscroll on:close>
  <span slot="heading">{display}</span>
  <EditField on:close on:update {value} {field} {bcp} {isSompeng} {addingLexeme} />
</Modal>
