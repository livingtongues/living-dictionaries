<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Textbox from './cells/Textbox.svelte';
  import SemanticDomains from './cells/SemanticDomains.svelte';
  import SelectPOS from './cells/SelectPOS.svelte';
  import SelectSpeakerCell from './cells/SelectSpeakerCell.svelte';
  import AudioCell from './cells/AudioCell.svelte';
  import BadgeArray from '$svelteui/data/BadgeArray.svelte';
  import Image from '$lib/components/image/Image.svelte';
  import { saveUpdateToFirestore } from '$lib/helpers/entry/update';
  import { dictionary } from '$lib/stores';
  import type { IColumn, IEntry } from '$lib/interfaces';
  export let column: IColumn,
    entry: IEntry,
    canEdit = false;

  let updatedValue;
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    valueupdate: { field: string; newValue: string[] }; // an array of strings for the sr field, but the valueupdate events being passed upwards are mostly strings
  }>();
</script>

<div
  class:sompeng={column.display === 'Sompeng-Mardir'}
  class="{updatedValue !== undefined
    ? 'bg-green-100 border-green-400 border'
    : ''} h-full w-full inline-block">
  {#if column.field === 'soundFile'}
    <AudioCell {canEdit} {entry} />
  {:else if column.field === 'photoFile'}
    {#if entry.pf}
      <Image {canEdit} {entry} square={60} />
    {/if}
    <!-- // TODO: add videos to columns -->
    <!-- {:else if column.field === 'videoFile'}
    {#if entry.vfs}
      <VideoCell {canEdit} {entry} />
    {/if} -->
  {:else if column.field === 'speaker'}
    <SelectSpeakerCell {canEdit} {entry} />
  {:else if column.field === 'ps'}
    <SelectPOS
      {canEdit}
      value={entry.ps}
      on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
  {:else if column.field === 'sdn'}
    <SemanticDomains
      {canEdit}
      {entry}
      on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
  {:else if column.field === 'sr'}
    <!--TODO it doesn't work. A possible solution is to make it a child -->
    <BadgeArray
      strings={entry.sr || []}
      {canEdit}
      promptMessage={$_('entry.sr')}
      addMessage={$_('misc.add', { default: 'Add' })}
      on:valueupdated={(e) => dispatch('valueupdate', { field: 'sr', newValue: e.detail })} />
  {:else if column.gloss === true}
    <Textbox
      {canEdit}
      field={`gl.${column.field}`}
      value={entry.gl && entry.gl[column.field]}
      {updatedValue}
      htmlValue={(entry._highlightResult &&
        entry._highlightResult.gl &&
        entry._highlightResult.gl[column.field] &&
        entry._highlightResult.gl[column.field].value) ||
        ''}
      on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
  {:else if column.exampleSentence === true}
    <Textbox
      {canEdit}
      field={`xs.${column.field}`}
      value={entry.xs && entry.xs[column.field]}
      {updatedValue}
      htmlValue={(entry._highlightResult &&
        entry._highlightResult.xs &&
        entry._highlightResult.xs[column.field] &&
        entry._highlightResult.xs[column.field].value) ||
        ''}
      on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
  {:else}
    <Textbox
      {canEdit}
      field={column.field}
      value={entry[column.field]}
      {updatedValue}
      htmlValue={(entry._highlightResult &&
        entry._highlightResult[column.field] &&
        entry._highlightResult[column.field].value) ||
        ''}
      on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
  {/if}
</div>
