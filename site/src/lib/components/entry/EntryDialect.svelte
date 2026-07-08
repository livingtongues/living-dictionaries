<script lang="ts">
  import type { EntryData } from '$lib/types'
  import type { SelectOption } from '$lib/components/ui/array/select-options.interface'
  import ModalEditableArray from '$lib/components/ui/array/ModalEditableArray.svelte'
  import { page } from '$app/state'

  interface Props {
    dialects: EntryData['dialects']
    entry_id: string
    can_edit?: boolean
    showPlus?: boolean
  }

  const {
    dialects,
    entry_id,
    can_edit = false,
    showPlus = true,
  }: Props = $props()

  const { dialects: dictionary_dialects, db_operations } = $derived(page.data)
  const dialect_ids = $derived(dialects.map(dialect => dialect.id))
  // Seed options from the dictionary-wide store, but always fold in this entry's
  // OWN dialects so their names resolve even before that store has loaded
  // (otherwise the chip falls back to rendering the raw id — the "hash" bug).
  const options = $derived.by(() => {
    const seen: Record<string, true> = {}
    const result: SelectOption[] = []
    for (const dialect of [...$dictionary_dialects, ...dialects]) {
      if (seen[dialect.id]) continue
      seen[dialect.id] = true
      result.push({ value: dialect.id, name: dialect.name.default })
    }
    return result
  })

  async function on_update(new_values: string[]) {
    // go through current dialect_ids and check if they are in the new_values, if not remove them
    for (const dialect_id of dialect_ids) {
      const value_is_removed = !new_values.includes(dialect_id)
      if (value_is_removed) {
        await db_operations.assign_dialect({ dialect_id, entry_id, remove: true })
      }
    }

    for (const dialect_id of new_values) {
      if (dialect_ids.includes(dialect_id)) continue // everything is already set - this value wasn't changed

      // need to assign dialect
      if ($dictionary_dialects.find(({ id }) => id === dialect_id)) {
        // if the value is in the dialects, assign it to this entry
        await db_operations.assign_dialect({ dialect_id, entry_id })
      } else {
        // if a value is not in the dictionary's dialects first add the dialect to the dictionary
        const data = await db_operations.insert_dialect({ name: { default: dialect_id } })
        await db_operations.assign_dialect({ dialect_id: data.id, entry_id })
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
    <span>{page.data.t('entry_field.dialects')}</span>
  {/snippet}
</ModalEditableArray>
