<script lang="ts">
  import { t } from 'svelte-i18n';
  import Textbox from './cells/Textbox.svelte';
  import SemanticDomains from './cells/SemanticDomains.svelte';
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte';
  import EntryDialect from '$lib/components/entry/EntryDialect.svelte';
  import SelectSpeakerCell from './cells/SelectSpeakerCell.svelte';
  import SelectSource from './cells/SelectSource.svelte';
  import Image from '$lib/components/image/Image.svelte';
  import type { ExpandedEntry, IColumn } from '@living-dictionaries/types';
  import Audio from '../../entries/Audio.svelte';
  import { createEventDispatcher } from 'svelte';

  export let column: IColumn;
  export let entry: ExpandedEntry;
  export let canEdit = false;

  const dispatch = createEventDispatcher<{
    valueupdate: { field: string; newValue: string | string[] };
  }>();
</script>

<div
  class:sompeng={column.display === 'Sompeng'}
  class="h-full w-full inline-block">
  {#if column.field === 'soundFile'}
    <Audio class="h-full text-sm" minimal {canEdit} {entry} let:playing>
      <span class:text-blue-700={playing} class="i-material-symbols-hearing text-lg mt-1" />
    </Audio>
  {:else if column.field === 'photoFile'}
    {@const first_photo = entry.senses?.[0]?.photo_files?.[0]}
    {#if first_photo}
      <Image
        {canEdit}
        title={entry.lexeme}
        gcs={first_photo.specifiable_image_url}
        square={60}
        on:deleteImage />
    {/if}
    <!-- TODO: add videos to columns -->
  {:else if column.field === 'speaker'}
    <SelectSpeakerCell {canEdit} {entry} />
  {:else if column.field === 'ps'}
    <EntryPartOfSpeech
      {canEdit}
      value={entry.senses[0].translated_parts_of_speech}
      on:valueupdate />
  {:else if column.field === 'sdn'}
    <SemanticDomains
      {canEdit}
      {entry}
      on:valueupdate />
  {:else if column.field === 'di'}
    <EntryDialect
      {canEdit}
      dialects={entry.dialects}
      on:valueupdate />
  {:else if column.field === 'sr'}
    <SelectSource
      {canEdit}
      value={entry.sources}
      on:valueupdate />
  {:else if column.gloss === true}
    <Textbox
      {canEdit}
      field={`gl.${column.field}`}
      value={entry.senses?.[0]?.glosses?.[column.field]}
      display={$t(`gl.${column.field}`, { default: 'Gloss' })}
      on:valueupdate />
    <!-- htmlValue={entry._highlightResult?.gl?.[column.field]?.value} -->
  {:else if column.exampleSentence === true}
    <Textbox
      {canEdit}
      field={`xs.${column.field}`}
      value={entry.senses?.[0]?.example_sentences?.[column.field]}
      display={`${column.field !== 'xv' ? $t(`gl.${column.field}`) : ''} ${$t(
        'entry.example_sentence',
        {
          default: 'Example Sentence',
        }
      )}`}
      on:valueupdate />
  {:else if column.field === 'scn'}
    <Textbox
      {canEdit}
      field="scn"
      value={entry.scientific_names?.[0]}
      display={$t('entry.scn', { default: 'Scientific Name' })}
      on:valueupdate={({detail: {field, newValue}}) =>
        dispatch('valueupdate', { field, newValue: [newValue]},
        )} />
  {:else}
    <Textbox
      {canEdit}
      field={column.field}
      value={entry[column.field]}
      display={$t(`entry.${column.field}`, { default: 'Edit' })}
      on:valueupdate />
    <!-- htmlValue={entry._highlightResult?.[column.field]?.value} -->
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

  div :global(button) {
    margin-bottom: 0px !important;
  }
</style>
