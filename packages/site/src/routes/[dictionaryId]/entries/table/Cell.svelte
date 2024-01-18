<script lang="ts">
  import { page } from '$app/stores';
  import Textbox from './cells/Textbox.svelte';
  import EntrySemanticDomains from '$lib/components/entry/EntrySemanticDomains.svelte';
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
  export let canEdit = false;
  export let dictionaryId: string;

  $: i18nKey = `entry_field.${column.field}` as `entry_field.${EntryFieldValue}`

  const dispatch = createEventDispatcher<{
    valueupdate: { field: string; newValue: string | string[] };
  }>();
</script>

<div
  class:sompeng={column.display === 'Sompeng'}
  class="h-full w-full flex cell">
  {#if column.field === 'audio'}
    <Audio class="h-full text-sm" minimal {canEdit} {entry} let:playing>
      <span class:text-blue-700={playing} class="i-material-symbols-hearing text-lg mt-1" />
    </Audio>
  {:else if column.field === 'photo'}
    {@const first_photo = entry.senses?.[0]?.photo_files?.[0]}
    {#if first_photo}
      <Image
        {canEdit}
        title={entry.lexeme}
        gcs={first_photo.specifiable_image_url}
        square={60}
        on:deleteImage />
    {:else if canEdit}
      <AddImage {dictionaryId} entryId={entry.id} class="text-xs" />
    {/if}
  {:else if column.field === 'speaker'}
    <SelectSpeakerCell {canEdit} {entry} />
  {:else if column.field === 'parts_of_speech'}
    <EntryPartOfSpeech
      {canEdit}
      value={entry.senses?.[0]?.translated_parts_of_speech}
      showPlus={false}
      on:valueupdate />
  {:else if column.field === 'semantic_domains'}
    <EntrySemanticDomains {canEdit} showPlus={false} sense={entry.senses?.[0]} on:valueupdate />
  {:else if column.field === 'dialects'}
    <EntryDialect
      {canEdit}
      showPlus={false}
      {dictionaryId}
      dialects={entry.dialects}
      on:valueupdate />
  {:else if column.field === 'sources'}
    <SelectSource
      {canEdit}
      value={entry.sources}
      on:valueupdate />
  {:else if column.field === 'gloss'}
    <Textbox
      {canEdit}
      field={column.field}
      value={entry.senses?.[0]?.glosses?.[column.bcp]}
      display={column.display}
      on:update={({detail}) => dispatch('valueupdate', { field: `gl.${column.bcp}`, newValue: detail})} />
  {:else if column.field === 'example_sentence'}
    <Textbox
      {canEdit}
      field={column.field}
      value={entry.senses?.[0]?.example_sentences?.[0]?.[column.bcp]}
      display={column.display}
      on:update={({detail}) => dispatch('valueupdate', { field: `xs.${column.bcp}`, newValue: detail})} />
  {:else if column.field === 'scientific_names'}
    <Textbox
      {canEdit}
      field={column.field}
      value={entry.scientific_names?.[0]}
      display={$page.data.t('entry_field.scientific_names')}
      on:update={({detail}) => dispatch('valueupdate', { field: EntryFields.scientific_names, newValue: [detail]} )} />
  {:else if column.field === 'local_orthography'}
    <Textbox
      {canEdit}
      field={column.field}
      value={entry[`local_orthography_${column.orthography_index}`]}
      display={column.display}
      on:update={({detail}) => dispatch('valueupdate', { field: `lo${column.orthography_index}`, newValue: detail} )} />
  {:else}
    <Textbox
      field={column.field}
      {canEdit}
      value={entry[column.field]}
      display={$page.data.t(i18nKey, {fallback: column.display})}
      on:update={({detail}) => dispatch('valueupdate', { field: EntryFields[column.field], newValue: detail})} />
  {/if}
</div>
<!-- htmlValue={entry._highlightResult?.[column.field]?.value} -->


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
