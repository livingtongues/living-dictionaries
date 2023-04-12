<script lang="ts">
  import { Story } from 'kitbook';
  import { Button, ShowHide } from 'svelte-pieces';
  import EditField from './EditField.svelte';
  import EditFieldModal from './EditFieldModal.svelte';
</script>

<!-- prettier-ignore -->
# Edit Field Modal

<Story name="lexeme">
  <EditField value="banana" field="lx" />
</Story>

<Story name="gloss language with keyboard">
  <EditField value="should have keyboard icon" field="gl.as" />
</Story>

<!-- <Story name="Sompeng">
  <EditField display="Sompeng" value="Sompeng" field="gl" />
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
