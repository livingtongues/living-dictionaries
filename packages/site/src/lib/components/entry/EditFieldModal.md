<script lang="ts">
  import EditField from './EditField.svelte';
  import EditFieldModal from './EditFieldModal.svelte';

  import { Story } from 'kitbook';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
</script>

<!-- prettier-ignore -->
# Edit Field Modal

<Story name="lexeme">
  <EditField value="banana" field="lx" />
</Story>

<Story name="gloss language with keyboard">
  <EditField value="should have keyboard icon" field="gl.as" />
</Story>

<!-- <Story name="Sompeng-Mardir">
  <EditField display="Sompeng-Mardir" value="Sompeng" field="gl" />
</Story> -->

<Story name="italicized gloss">
  <EditField value="red <i>tomato</i>" field="gl.as" />
</Story>

<Story name="interlinear">
  <EditField value="3p.sɢ.ind" field="in" />
</Story>

<Story name="notes">
  <EditField value="hello" field="nt" />
</Story>

<Story name="modal">
  <ShowHide let:show let:toggle>
    <Button onclick={toggle}>Show Modal</Button>
    {#if show}
      <EditFieldModal on:close={toggle} display="Keyman test" value="hello" field="gl" />
    {/if}
  </ShowHide>
</Story>
