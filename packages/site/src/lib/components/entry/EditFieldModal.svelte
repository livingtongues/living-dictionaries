<script lang="ts">
  import { Modal } from 'svelte-pieces';
  import EditField from './EditField.svelte';

  export let value = '';
  export let field: string;
  export let display: string;
  export let adding = false;
</script>

<Modal noscroll on:close>
  <span slot="heading">{display}</span>
  <EditField on:close on:valueupdate {value} {field} {display} {adding} />
</Modal>
