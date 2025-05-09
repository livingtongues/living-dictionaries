<script lang="ts">
  import type { EntryData } from '@living-dictionaries/types'
  import type { SelectOption } from '$lib/components/ui/array/select-options.interface'
  import ModalEditableArray from '$lib/components/ui/array/ModalEditableArray.svelte'
  import { page } from '$app/stores'

  export let dialects: EntryData['dialects']
  export let entry_id: string
  export let can_edit = false
  export let showPlus = true

  $: ({ dialects: dictionary_dialects, dbOperations } = $page.data)
  $: dialect_ids = dialects.map(dialect => dialect.id)
  $: active_dialects = $dictionary_dialects.filter(dialect => dialect_ids.includes(dialect.id)).map(dialect => dialect.id)
  $: options = $dictionary_dialects.map(dialect => ({ value: dialect.id, name: dialect.name.default })) satisfies SelectOption[]

  async function on_update(new_values: string[]) {
    // go through current dialect_ids and check if they are in the new_values, if not remove them
    for (const dialect_id of dialect_ids) {
      const value_is_removed = !new_values.includes(dialect_id)
      if (value_is_removed) {
        await dbOperations.assign_dialect({ dialect_id, entry_id, remove: true })
      }
    }

    for (const dialect_id of new_values) {
      if (dialect_ids.includes(dialect_id)) continue // everything is already set - this value wasn't changed

      // need to assign dialect
      if ($dictionary_dialects.find(({ id }) => id === dialect_id)) {
        // if the value is in the dialects, assign it to this entry
        await dbOperations.assign_dialect({ dialect_id, entry_id })
      } else {
        // if a value is not in the dictionary's dialects first add the dialect to the dictionary
        const data = await dbOperations.insert_dialect({ name: { default: dialect_id } })
        await dbOperations.assign_dialect({ dialect_id: data.id, entry_id })
      }
    }
  }
</script>

<ModalEditableArray
  values={active_dialects}
  {options}
  {can_edit}
  canWriteIn
  {showPlus}
  placeholder={$page.data.t('entry_field.dialects')}
  {on_update}>
  <span slot="heading">{$page.data.t('entry_field.dialects')}</span>
</ModalEditableArray>
