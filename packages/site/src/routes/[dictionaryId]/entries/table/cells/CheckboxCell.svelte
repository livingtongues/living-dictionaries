<!-- <script lang="ts">
  export let checkbox = null
  export let row
  export let column
  export let rowNumber
  export let on_click: (checked: boolean) => void

  setTimeout(() => {
    dispatch('valueupdate', {
      row,
      column,
      value: checkbox.checked,
      rowNumber,
    })
  }, 0)
</script>

<div class="text-center">
  <input
    type="checkbox"
    bind:this={checkbox}
    checked={row.data[column.dataName]}
    on:click={onChange} />
</div> -->
