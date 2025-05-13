<script lang="ts">
  import type {
    EntryData,
    IColumn,
    TablesUpdate,
  } from '@living-dictionaries/types'
  import Audio from '../components/Audio.svelte'
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
  import EntryTag from '$lib/components/entry/EntryTag.svelte'

  export let column: IColumn
  export let entry: EntryData
  export let can_edit = false
  export let dbOperations: DbOperations

  $: sense = entry.senses?.[0]
  $: first_photo = entry.senses?.[0]?.photos?.[0]

  function update_entry(update: TablesUpdate<'entries'>) {
    dbOperations.update_entry({ ...update, id: entry.id })
  }
  function update_sense(update: TablesUpdate<'senses'>) {
    dbOperations.update_sense({ ...update, id: sense.id })
  }
</script>

<div
  class:sompeng={column.display === 'Sompeng'}
  class="h-full w-full flex cell">
  {#if column.field === 'audio'}
    <Audio class="h-full text-sm" context="table" {can_edit} sound_file={entry.audios?.[0] || null} {entry} />
  {:else if column.field === 'photo'}
    {#if first_photo}
      <Image
        square={60}
        title={entry.main.lexeme.default}
        gcs={first_photo.serving_url}
        {can_edit}
        on_delete_image={async () =>
          await dbOperations.update_photo({
            deleted: new Date().toISOString(),
            id: first_photo.id,
          })} />
    {:else if can_edit}
      <!-- <div class="h-20 bg-gray-100 hover:bg-gray-300 mb-2 flex flex-col"> -->
      <AddImage
        upload_image={file =>
          dbOperations.addImage({ sense_id: sense.id, file })}>
        <div class="text-xs"></div>
      </AddImage>
      <!-- </div> -->
    {/if}
  {:else if column.field === 'speaker'}
    <SelectSpeakerCell {can_edit} {entry} />
  {:else if column.field === 'parts_of_speech'}
    <EntryPartOfSpeech
      {can_edit}
      value={sense.parts_of_speech}
      showPlus={false}
      on_update={(new_value) => {
        sense.parts_of_speech = new_value
        update_sense({ parts_of_speech: new_value })
      }} />
  {:else if column.field === 'semantic_domains'}
    <EntrySemanticDomains
      {can_edit}
      show_plus={false}
      semantic_domain_keys={sense.semantic_domains}
      write_in_semantic_domains={sense.write_in_semantic_domains}
      on_update={(new_value) => {
        sense.semantic_domains = new_value
        update_sense({ semantic_domains: new_value })
      }}
      on_update_write_in={(new_value) => {
        sense.write_in_semantic_domains = new_value
        update_sense({ write_in_semantic_domains: new_value })
      }} />
  {:else if column.field === 'dialects'}
    <EntryDialect
      entry_id={entry.id}
      {can_edit}
      showPlus={false}
      dialects={entry.dialects || []} />
  {:else if column.field === 'custom_tags'}
    <EntryTag
      entry_id={entry.id}
      {can_edit}
      showPlus={false}
      tags={entry.tags || []} />
  {:else if column.field === 'sources'}
    <EntrySource
      {can_edit}
      value={entry.main.sources}
      on_update={(new_value) => {
        entry.main.sources = new_value
        update_entry({ sources: new_value })
      }} />
  {:else if column.field === 'gloss'}
    <Textbox
      field={column.field}
      value={sense.glosses?.[column.bcp]}
      display={column.display}
      on_update={(new_value) => {
        sense.glosses = { ...sense.glosses, [column.bcp]: new_value }
        update_sense({ glosses: sense.glosses })
      }} />
  {:else if column.field === 'example_sentence'}
    {@const sentence = sense.sentences?.[0]}
    {#if column.bcp === 'vn'}
      <Textbox
        field={column.field}
        value={sentence?.text?.default}
        display={$page.data.t('entry_field.example_sentence')}
        on_update={async (new_value) => {
          if (!sentence?.id) {
            await dbOperations.insert_sentence({
              sentence: { text: { default: new_value } },
              sense_id: sense.id,
            })
          } else {
            await dbOperations.update_sentence({
              text: { default: new_value },
              id: sentence.id,
            })
          }
        }} />
    {:else}
      {#if sentence}
        <Textbox
          field={column.field}
          value={sentence?.translation?.[column.bcp]}
          display="{$page.data.t({ dynamicKey: `gl.${column.bcp}`, fallback: column.bcp })}: {$page.data.t('entry_field.example_sentence')}"
          on_update={async (new_value) => {
            await dbOperations.update_sentence({
              translation: {
                ...sentence?.translation,
                [column.bcp]: new_value,
              },
              id: sentence.id,
            })
          }} />
      {:else}
        <div on:click={() => alert('First add example sentence.')} class="h-full"></div>
      {/if}
    {/if}
  {:else if column.field === 'scientific_names'}
    <Textbox
      field={column.field}
      value={entry.main.scientific_names?.[0]}
      display={$page.data.t('entry_field.scientific_names')}
      on_update={(new_value) => {
        entry.main.scientific_names = [new_value]
        update_entry({ scientific_names: entry.main.scientific_names })
      }} />
  {:else if column.field === 'local_orthography'}
    {@const orthography_field = `lo${column.orthography_index}`}
    <Textbox
      field={column.field}
      value={entry.main.lexeme[orthography_field]}
      display={column.display}
      on_update={(new_value) => {
        entry.main.lexeme[orthography_field] = new_value
        update_entry({ lexeme: entry.main.lexeme })
      }} />
  {:else if column.field === 'lexeme'}
    <Textbox
      field={column.field}
      value={entry.main.lexeme.default}
      display={$page.data.t('entry_field.lexeme')}
      on_update={(new_value) => {
        if (new_value) {
          entry.main.lexeme.default = new_value
          update_entry({ lexeme: entry.main.lexeme })
        }
      }} />
  {:else if column.field === 'notes'}
    <Textbox
      field={column.field}
      value={entry.main.notes?.default}
      display={$page.data.t('entry_field.notes')}
      on_update={(new_value) => {
        if (new_value) {
          entry.main.notes = { default: new_value }
          update_entry({ notes: entry.main.notes })
        }
      }} />
  {:else if column.field === 'interlinearization' || column.field === 'morphology' || column.field === 'phonetic' || column.field === 'elicitation_id'}
    <Textbox
      field={column.field}
      value={entry.main[column.field]}
      display={$page.data.t(`entry_field.${column.field}`)}
      on_update={(new_value) => {
        entry.main[column.field] = new_value
        update_entry({ [column.field]: new_value })
      }} />
  {:else if column.field === 'noun_class'}
    <Textbox
      field={column.field}
      value={sense.noun_class}
      display={$page.data.t(`entry_field.${column.field}`)}
      on_update={(new_value) => {
        sense.noun_class = new_value
        update_sense({ noun_class: new_value })
      }} />
  {:else if column.field === 'plural_form'}
    <Textbox
      field={column.field}
      value={sense.plural_form?.default}
      display={$page.data.t(`entry_field.${column.field}`)}
      on_update={(new_value) => {
        sense.plural_form = { default: new_value }
        update_sense({ plural_form: sense.plural_form })
      }} />
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
    flex: 1;
  }

  div :global(button) {
    margin-bottom: 0px !important;
  }
</style>
