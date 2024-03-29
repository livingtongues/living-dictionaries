<script lang="ts">
  import { page } from '$app/stores';
  import Textbox from './cells/Textbox.svelte';
  import SupaEntrySemanticDomains from '$lib/components/entry/SupaEntrySemanticDomains.svelte';
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte';
  import EntryDialect from '$lib/components/entry/EntryDialect.svelte';
  import SelectSpeakerCell from './cells/SelectSpeakerCell.svelte';
  import SelectSource from '$lib/components/entry/EntrySource.svelte';
  import Image from '$lib/components/image/Image.svelte';
  import { EntryFields, type EntryFieldValue, type ExpandedEntry, type IColumn } from '@living-dictionaries/types';
  import Audio from '../../entries/Audio.svelte';
  import { createEventDispatcher } from 'svelte';
  import AddImage from '../AddImage.svelte';

  export let column: IColumn;
  export let entry: ExpandedEntry;
  export let can_edit = false;
  export let dictionaryId: string;

  $: i18nKey = `entry_field.${column.field}` as `entry_field.${EntryFieldValue}`
  $: sense = entry.senses?.[0] || {}

  const dispatch = createEventDispatcher<{
    valueupdate: { field: string; newValue: string | string[] };
  }>();
</script>

<div
  class:sompeng={column.display === 'Sompeng'}
  class="h-full w-full flex cell">
  {#if column.field === 'audio'}
    <Audio class="h-full text-sm" context="table" {can_edit} {entry} />
  {:else if column.field === 'photo'}
    {@const first_photo = sense.photo_files?.[0]}
    {#if first_photo}
      <Image
        {can_edit}
        title={entry.lexeme}
        gcs={first_photo.specifiable_image_url}
        square={60}
        on:deleteImage />
    {:else if can_edit}
      <AddImage {dictionaryId} entryId={entry.id} class="text-xs" />
    {/if}
  {:else if column.field === 'speaker'}
    <SelectSpeakerCell {can_edit} {entry} />
  {:else if column.field === 'parts_of_speech'}
    <EntryPartOfSpeech
      {can_edit}
      value={sense.translated_parts_of_speech}
      showPlus={false}
      on_update={new_value => dispatch('valueupdate', { field: EntryFields.parts_of_speech, newValue: new_value})} />
  {:else if column.field === 'semantic_domains'}
    <SupaEntrySemanticDomains
      {can_edit}
      show_plus={false}
      semantic_domain_keys={sense.ld_semantic_domains_keys}
      write_in_semantic_domains={sense.write_in_semantic_domains}
      on_update={new_value => dispatch('valueupdate', {
        field: EntryFields.semantic_domains,
        newValue: new_value,
      })}
      on_update_write_in={new_value => dispatch('valueupdate', {
        field: 'sd',
        newValue: new_value,
      })} />
  {:else if column.field === 'dialects'}
    <EntryDialect
      {can_edit}
      showPlus={false}
      {dictionaryId}
      dialects={entry.dialects}
      on_update={new_value => dispatch('valueupdate', { field: EntryFields.dialects, newValue: new_value })} />
  {:else if column.field === 'sources'}
    <SelectSource
      {can_edit}
      value={entry.sources}
      on:valueupdate />
  {:else if column.field === 'gloss'}
    <Textbox
      {can_edit}
      field={column.field}
      value={sense.glosses?.[column.bcp]}
      display={column.display}
      on_update={new_value => dispatch('valueupdate', { field: `gl.${column.bcp}`, newValue: new_value})} />
  {:else if column.field === 'example_sentence'}
    <Textbox
      {can_edit}
      field={column.field}
      value={sense.example_sentences?.[0]?.[column.bcp]}
      display={column.display}
      on_update={new_value => dispatch('valueupdate', { field: `xs.${column.bcp}`, newValue: new_value})} />
  {:else if column.field === 'scientific_names'}
    <Textbox
      {can_edit}
      field={column.field}
      value={entry.scientific_names?.[0]}
      display={$page.data.t('entry_field.scientific_names')}
      on_update={new_value => dispatch('valueupdate', { field: EntryFields.scientific_names, newValue: [new_value]} )} />
  {:else if column.field === 'local_orthography'}
    <Textbox
      {can_edit}
      field={column.field}
      value={entry[`local_orthography_${column.orthography_index}`]}
      display={column.display}
      on_update={new_value => dispatch('valueupdate', { field: `lo${column.orthography_index}`, newValue: new_value} )} />
  {:else}
    <Textbox
      field={column.field}
      {can_edit}
      value={entry[column.field]}
      display={$page.data.t(i18nKey, {fallback: column.display})}
      on_update={new_value => dispatch('valueupdate', { field: EntryFields[column.field], newValue: new_value})} />
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
