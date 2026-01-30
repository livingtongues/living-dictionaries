<script lang="ts">
  import type { TablesUpdate } from '@living-dictionaries/types'

  interface Props {
    field: keyof TablesUpdate<'dictionaries'>;
    value: string;
    update_dictionary: (change: TablesUpdate<'dictionaries'>) => Promise<void>;
  }

  let { field, value = $bindable(), update_dictionary }: Props = $props();

  let debouncedSaveTimer: NodeJS.Timeout
  let unsaved = $state(false)

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

<input bind:value oninput={valueChanged} class:unsaved={unsaved} />

<style>
  .unsaved {
    outline: solid 1px #00cc00;
  }
</style>
