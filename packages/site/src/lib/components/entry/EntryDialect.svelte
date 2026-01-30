<script lang="ts">
  import type { EntryData } from '@living-dictionaries/types'
  import type { SelectOption } from '$lib/components/ui/array/select-options.interface'
  import ModalEditableArray from '$lib/components/ui/array/ModalEditableArray.svelte'
  import { page } from '$app/state'

  interface Props {
    dialects: EntryData['dialects'];
    entry_id: string;
    can_edit?: boolean;
    showPlus?: boolean;
  }

  let {
    dialects,
    entry_id,
    can_edit = false,
    showPlus = true
  }: Props = $props();

  let { dialects: dictionary_dialects, dbOperations } = $derived(page.data)
  let dialect_ids = $derived(dialects.map(dialect => dialect.id))
  let options = $derived($dictionary_dialects.map(dialect => ({ value: dialect.id, name: dialect.name.default })) satisfies SelectOption[])

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
  values={dialect_ids}
  {options}
  {can_edit}
  canWriteIn
  {showPlus}
  placeholder={page.data.t('entry_field.dialects')}
  {on_update}>
  {#snippet heading()}
    <span >{page.data.t('entry_field.dialects')}</span>
  {/snippet}
</ModalEditableArray>
