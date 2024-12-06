<script lang="ts">
  import type { SelectOption } from '$lib/components/ui/array/select-options.interface'
  import ModalEditableArray from '$lib/components/ui/array/ModalEditableArray.svelte'
  import { page } from '$app/stores'

  export let tag_ids: string[]
  export let entry_id: string
  export let can_edit = false
  export let showPlus = true

  $: ({ tags, dbOperations } = $page.data)
  $: active_tags = $tags.filter(tag => tag_ids.includes(tag.id)).map(tag => tag.id)
  $: options = $tags.map(tag => ({ value: tag.id, name: tag.name })) satisfies SelectOption[]

  async function on_update(new_values: string[]) {
    // go through current tag_ids and check if they are in the new_values, if not remove them
    for (const tag_id of tag_ids) {
      const value_is_removed = !new_values.includes(tag_id)
      if (value_is_removed) {
        await dbOperations.assign_tag({ tag_id, entry_id, remove: true })
      }
    }

    for (const tag_id of new_values) {
      if (tag_ids.includes(tag_id)) continue // everything is already set - this value wasn't changed

      // need to assign tag
      if ($tags.find(({ id }) => id === tag_id)) {
        // if the value is in the tags, assign it to this entry
        await dbOperations.assign_tag({ tag_id, entry_id })
      } else {
        // if a value is not in the dictionary's tags first add the tag to the dictionary
        const data = await dbOperations.insert_tag({ tag: { name: tag_id } })
        await dbOperations.assign_tag({ tag_id: data.tag_id, entry_id })
      }
    }
  }
</script>

<ModalEditableArray
  values={active_tags}
  {options}
  {can_edit}
  canWriteIn
  {showPlus}
  placeholder={$page.data.t('entry_field.tag')}
  {on_update}>
  <span slot="heading">{$page.data.t('entry_field.tag')}</span>
</ModalEditableArray>
