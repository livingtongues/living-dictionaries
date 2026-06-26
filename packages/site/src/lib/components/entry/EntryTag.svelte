<script lang="ts">
  import type { EntryData } from '@living-dictionaries/types'
  import type { SelectOption } from '$lib/components/ui/array/select-options.interface'
  import ModalEditableArray from '$lib/components/ui/array/ModalEditableArray.svelte'
  import { page } from '$app/stores'
  import { should_include_tag } from '$lib/helpers/tag-visibility'

  export let tags: EntryData['tags']
  export let entry_id: string
  export let can_edit = false
  export let showPlus = true

  $: ({ tags: dictionary_tags, dbOperations, admin } = $page.data)
  $: tag_ids = tags.map(tag => tag.id)
  $: visible_tags = $dictionary_tags.filter(tag => should_include_tag(tag, $admin))
  $: options = visible_tags.map(tag => ({ value: tag.id, name: tag.name })) satisfies SelectOption[]

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
      if ($dictionary_tags.find(({ id }) => id === tag_id)) {
        // if the value is in the tags, assign it to this entry
        await dbOperations.assign_tag({ tag_id, entry_id })
      } else {
        // if a value is not in the dictionary's tags first add the tag to the dictionary
        const data = await dbOperations.insert_tag({ name: tag_id })
        await dbOperations.assign_tag({ tag_id: data.id, entry_id })
      }
    }
  }
</script>

<ModalEditableArray
  values={tag_ids}
  {options}
  {can_edit}
  canWriteIn
  {showPlus}
  placeholder={$page.data.t('entry_field.custom_tags')}
  {on_update}>
  <span slot="heading">{$page.data.t('entry_field.custom_tags')}</span>
</ModalEditableArray>
