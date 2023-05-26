<script lang="ts">
  import { t } from 'svelte-i18n';
  import Textbox from './cells/Textbox.svelte';
  import SemanticDomains from './cells/SemanticDomains.svelte';
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte';
  import SelectSpeakerCell from './cells/SelectSpeakerCell.svelte';
  import DialectCell from './cells/DialectCell.svelte';
  import SelectSource from './cells/SelectSource.svelte';
  import AudioCell from './cells/AudioCell.svelte';
  import Image from '$lib/components/image/Image.svelte';
  import { saveUpdateToFirestore } from '$lib/helpers/entry/update';
  import { deleteImage } from '$lib/helpers/delete';
  import { dictionary } from '$lib/stores';
  import type { IColumn, IEntry } from '@living-dictionaries/types';

  export let column: IColumn;
  export let entry: IEntry;
  export let canEdit = false;

  let updatedValue;
</script>

<div
  class:sompeng={column.display === 'Sompeng'}
  class="{updatedValue !== undefined
    ? 'bg-green-100 border-green-400 border'
    : ''} h-full w-full inline-block">
  {#if column.field === 'soundFile'}
    <AudioCell {canEdit} {entry} />
  {:else if column.field === 'photoFile'}
    {#if entry.pf}
      <Image
        {canEdit}
        lexeme={entry.lx}
        gcs={entry.pf.gcs}
        square={60}
        on:deleteImage={() => deleteImage(entry)} />
    {/if}
    <!-- // TODO: add videos to columns -->
    <!-- {:else if column.field === 'videoFile'}
    {#if entry.vfs}
      <VideoCell {canEdit} {entry} />
    {/if} -->
  {:else if column.field === 'speaker'}
    <SelectSpeakerCell {canEdit} {entry} />
  {:else if column.field === 'ps'}
    <EntryPartOfSpeech
      {canEdit}
      value={entry.ps}
      on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
  {:else if column.field === 'sdn'}
    <SemanticDomains
      {canEdit}
      {entry}
      on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
  {:else if column.field === 'di'}
    <DialectCell
      {canEdit}
      value={entry.di?.[0]}
      on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
  {:else if column.field === 'sr'}
    <SelectSource
      {canEdit}
      value={typeof entry.sr === 'string' ? [entry.sr] : entry.sr}
      on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
  {:else if column.gloss === true}
    <Textbox
      {canEdit}
      field={`gl.${column.field}`}
      value={entry.gl?.[column.field]}
      display={$t(`gl.${column.field}`, { default: 'Gloss' })}
      {updatedValue}
      htmlValue={entry._highlightResult?.gl?.[column.field]?.value}
      on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
  {:else if column.exampleSentence === true}
    <Textbox
      {canEdit}
      field={`xs.${column.field}`}
      value={entry.xs && entry.xs[column.field]}
      display={`${column.field !== 'xv' ? $t(`gl.${column.field}`) : ''} ${$t(
        'entry.example_sentence',
        {
          default: 'Example Sentence',
        }
      )}`}
      {updatedValue}
      htmlValue={entry._highlightResult?.gl?.[column.field]?.value}
      on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
  {:else if column.field === 'scn'}
    <Textbox
      {canEdit}
      field="scn"
      value={entry.scn?.[0]}
      display={$t('entry.scn', { default: 'Scientific Name' })}
      {updatedValue}
      htmlValue={entry.scn?.[0]}
      on:valueupdate={(e) =>
        saveUpdateToFirestore(
          { detail: { field: 'scn', newValue: [e.detail.newValue] } },
          entry.id,
          $dictionary.id
        )} />
  {:else}
    <Textbox
      {canEdit}
      field={column.field}
      value={entry[column.field]}
      display={$t(`entry.${column.field}`, { default: 'Edit' })}
      {updatedValue}
      htmlValue={(entry._highlightResult &&
        entry._highlightResult[column.field] &&
        entry._highlightResult[column.field].value) ||
        ''}
      on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
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
