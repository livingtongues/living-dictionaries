<script lang="ts">
  import type { EntryData } from '$lib/types'
  import type { SelectOption } from '$lib/components/ui/array/select-options.interface'
  import ModalEditableArray from '$lib/components/ui/array/ModalEditableArray.svelte'
  import { page } from '$app/state'
  import { should_include_tag } from '$lib/tag/visibility'

  interface Props {
    tags: EntryData['tags']
    entry_id: string
    can_edit?: boolean
    showPlus?: boolean
  }

  const {
    tags,
    entry_id,
    can_edit = false,
    showPlus = true,
  }: Props = $props()

  const { tags: dictionary_tags, writes, auth_user } = $derived(page.data)
  const tag_ids = $derived(tags.map(tag => tag.id))
  const visible_tags = $derived($dictionary_tags.filter(tag => should_include_tag(tag, auth_user.admin_level)))
  // Seed options from the dictionary-wide store, but always fold in this entry's
  // OWN tags so their names resolve even before that store has loaded (otherwise
  // the chip falls back to rendering the raw id — the "hash" bug). The entry's
  // tags are already privacy-filtered upstream, so no leak.
  const options = $derived.by(() => {
    const seen: Record<string, true> = {}
    const result: SelectOption[] = []
    for (const tag of [...visible_tags, ...tags]) {
      if (seen[tag.id]) continue
      seen[tag.id] = true
      result.push({ value: tag.id, name: tag.name })
    }
    return result
  })

  async function on_update(new_values: string[]) {
    // go through current tag_ids and check if they are in the new_values, if not remove them
    for (const tag_id of tag_ids) {
      const value_is_removed = !new_values.includes(tag_id)
      if (value_is_removed) {
        await writes.assign_tag({ tag_id, entry_id, remove: true })
      }
    }

    for (const tag_id of new_values) {
      if (tag_ids.includes(tag_id)) continue // everything is already set - this value wasn't changed

      // need to assign tag
      if ($dictionary_tags.find(({ id }) => id === tag_id)) {
        // if the value is in the tags, assign it to this entry
        await writes.assign_tag({ tag_id, entry_id })
      } else {
        // if a value is not in the dictionary's tags first add the tag to the dictionary
        const data = await writes.insert_tag({ name: tag_id })
        await writes.assign_tag({ tag_id: data.id, entry_id })
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
  placeholder={page.data.t('entry_field.custom_tags')}
  {on_update}>
  {#snippet heading()}
    <span>{page.data.t('entry_field.custom_tags')}</span>
  {/snippet}
</ModalEditableArray>
