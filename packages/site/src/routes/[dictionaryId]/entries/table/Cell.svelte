<script lang="ts">
  import { type ActualDatabaseEntry, EntryFields, type ExpandedEntry, type GoalDatabaseEntry, type IColumn, type i18nEntryFieldKey } from '@living-dictionaries/types'
  import Audio from '../../entries/Audio.svelte'
  import Textbox from './cells/Textbox.svelte'
  import SelectSpeakerCell from './cells/SelectSpeakerCell.svelte'
  import { page } from '$app/stores'
  import EntrySemanticDomains from '$lib/components/entry/EntrySemanticDomains.svelte'
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte'
  import EntryDialect from '$lib/components/entry/EntryDialect.svelte'
  import EntrySource from '$lib/components/entry/EntrySource.svelte'
  import Image from '$lib/components/image/Image.svelte'
  import type { DbOperations } from '$lib/dbOperations'
  import AddImage from '$lib/components/image/AddImage.svelte'

  export let column: IColumn
  export let entry: ExpandedEntry
  export let can_edit = false
  export let dictionaryId: string
  export let dbOperations: DbOperations

  $: i18nKey = `entry_field.${column.field}` as i18nEntryFieldKey
  $: sense = entry.senses?.[0] || {}
  $: ({ speakers } = $page.data)

  function updateEntry(data: ActualDatabaseEntry) {
    dbOperations.updateEntry({ data: data as GoalDatabaseEntry, entryId: entry.id })
  }
</script>

<div
  class:sompeng={column.display === 'Sompeng'}
  class="h-full w-full flex cell">
  {#if column.field === 'audio'}
    <Audio class="h-full text-sm" context="table" {can_edit} {entry} updateEntryOnline={dbOperations.updateEntryOnline} />
  {:else if column.field === 'photo'}
    {@const first_photo = sense.photo_files?.[0]}
    {#if first_photo}
      <Image
        {can_edit}
        title={entry.lexeme}
        gcs={first_photo.specifiable_image_url}
        square={60}
        on_delete_image={async () => await dbOperations.deleteImage(entry)} />
    {:else if can_edit}
      <!-- <div class="h-20 bg-gray-100 hover:bg-gray-300 mb-2 flex flex-col"> -->
      <AddImage upload_image={file => dbOperations.addImage(entry.id, file)}>
        <div class="text-xs">
        </div>
      </AddImage>
      <!-- </div> -->
    {/if}
  {:else if column.field === 'speaker'}
    <SelectSpeakerCell speakers={$speakers} {can_edit} {entry} />
  {:else if column.field === 'parts_of_speech'}
    <EntryPartOfSpeech
      {can_edit}
      value={sense.translated_parts_of_speech}
      showPlus={false}
      on_update={new_value => updateEntry({ [EntryFields.parts_of_speech]: new_value })} />
  {:else if column.field === 'semantic_domains'}
    <EntrySemanticDomains
      {can_edit}
      show_plus={false}
      semantic_domain_keys={sense.ld_semantic_domains_keys}
      write_in_semantic_domains={sense.write_in_semantic_domains}
      on_update={new_value => updateEntry({ [EntryFields.semantic_domains]: new_value })}
      on_update_write_in={new_value => updateEntry({ sd: new_value })} />
  {:else if column.field === 'dialects'}
    <EntryDialect
      {can_edit}
      showPlus={false}
      {dictionaryId}
      dialects={entry.dialects}
      on_update={new_value => updateEntry({ [EntryFields.dialects]: new_value })} />
  {:else if column.field === 'sources'}
    <EntrySource
      {can_edit}
      value={entry.sources}
      on_update={new_value => updateEntry({ [EntryFields.sources]: new_value })} />
  {:else if column.field === 'gloss'}
    <Textbox
      {can_edit}
      field={column.field}
      value={sense.glosses?.[column.bcp]}
      display={column.display}
      on_update={new_value => updateEntry({ [`gl.${column.bcp}`]: new_value })} />
  {:else if column.field === 'example_sentence'}
    <Textbox
      {can_edit}
      field={column.field}
      value={sense.example_sentences?.[0]?.[column.bcp]}
      display={column.display}
      on_update={new_value => updateEntry({ [`xs.${column.bcp}`]: new_value })} />
  {:else if column.field === 'scientific_names'}
    <Textbox
      {can_edit}
      field={column.field}
      value={entry.scientific_names?.[0]}
      display={$page.data.t('entry_field.scientific_names')}
      on_update={new_value => updateEntry({ [EntryFields.scientific_names]: [new_value] })} />
  {:else if column.field === 'local_orthography'}
    <Textbox
      {can_edit}
      field={column.field}
      value={entry[`local_orthography_${column.orthography_index}`]}
      display={column.display}
      on_update={new_value => updateEntry({ [`lo${column.orthography_index}`]: new_value })} />
  {:else}
    <Textbox
      field={column.field}
      {can_edit}
      value={entry[column.field]}
      display={$page.data.t(i18nKey, { fallback: column.display })}
      on_update={new_value => updateEntry({ [EntryFields[column.field]]: new_value })} />
  {/if}
</div>

<style>
  /* Firefox */
  /* .hide-scrollbar {
    scrollbar-width: none;
  } */
  /* Safari and Chrome */
  /* .hide-scrollbar::-webkit-scrollbar {
    display: none;
  } */

  :global(.cell > *) {
    flex: 1
  }

  div :global(button) {
    margin-bottom: 0px !important;
  }
</style>
