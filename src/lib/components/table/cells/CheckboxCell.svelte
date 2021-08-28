<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  export let checkbox = null;
  export let row;
  export let column;
  export let rowNumber;

  function onChange(event) {
    // delay this until after the ui updates on the screen
    setTimeout(() => {
      dispatch('valueupdate', {
        row,
        column,
        value: checkbox.checked,
        rowNumber,
      });
    }, 0);
  }
</script>

<div class="checkbox-cell">
  <input
    type="checkbox"
    bind:this={checkbox}
    checked={row.data[column.dataName]}
    on:click={onChange} />
</div>

<style>
  .checkbox-cell {
    text-align: center;
  }
</style>
