<script lang="ts">
  import type { TablesUpdate } from '@living-dictionaries/types'

  export let field: keyof TablesUpdate<'dictionaries'>
  export let value: string
  export let update_dictionary: (change: TablesUpdate<'dictionaries'>) => Promise<void>

  let debouncedSaveTimer: NodeJS.Timeout
  let unsaved = false

  function valueChanged() {
    unsaved = true
    clearTimeout(debouncedSaveTimer)
    debouncedSaveTimer = setTimeout(save, 2000)
  }

  async function save() {
    try {
      await update_dictionary({ [field]: value })
      unsaved = false
    } catch (err) {
      alert(err)
    }
  }
</script>

<input bind:value on:input={valueChanged} class:unsaved={unsaved} />

<style>
  .unsaved {
    outline: solid 1px #00cc00;
  }
</style>
