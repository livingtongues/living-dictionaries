<script lang="ts">
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import EditField from './EditField.svelte';
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;

  export let value = '';
  export let field: string;
  export let display: string;
  export let adding = false;
</script>

<Modal on:close>
  <span slot="heading">{display}</span>
  <EditField on:close on:valueupdate {t} {value} {field} {display} {adding} />
</Modal>
