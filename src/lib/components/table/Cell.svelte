<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Textbox from './cells/Textbox.svelte';
  import SemanticDomains from './cells/SemanticDomains.svelte';
  import SelectPOS from './cells/SelectPOS.svelte';
  import SelectSpeakerCell from './cells/SelectSpeakerCell.svelte';
  import AudioCell from './cells/AudioCell.svelte';
  import Image from '$lib/components/image/Image.svelte';

  import type { IColumn, IEntry } from '$lib/interfaces';
  export let column: IColumn,
    entry: IEntry,
    canEdit = false;

  let updatedValue;

  import { dictionary } from '$lib/stores';
  import { updateOnline } from '$sveltefirets';
  async function saveUpdateToFirestore(e) {
    try {
      await updateOnline<IEntry>(
        `dictionaries/${$dictionary.id}/words/${entry.id}`,
        {
          [e.detail.field]: e.detail.newValue,
        },
        { abbreviate: true }
      );
    } catch (err) {
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
  }
</script>

<div
  class:sompeng={column.display === 'Sompeng-Mardir'}
  class="{updatedValue !== undefined
    ? 'bg-green-100 border-green-400 border'
    : ''} h-full w-full inline-block"
>
  {#if column.field === 'soundFile'}
    <AudioCell {canEdit} {entry} />
  {:else if column.field === 'photoFile'}
    {#if entry.pf}
      <Image {canEdit} {entry} square={60} />
    {/if}
  {:else if column.field === 'speaker'}
    <SelectSpeakerCell {canEdit} {entry} />
  {:else if column.field === 'ps'}
    <SelectPOS {canEdit} value={entry.ps} on:valueupdate={saveUpdateToFirestore} />
  {:else if column.field === 'sdn'}
    <SemanticDomains {canEdit} {entry} on:valueupdate={saveUpdateToFirestore} />
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
      on:valueupdate={saveUpdateToFirestore}
    />
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
      on:valueupdate={saveUpdateToFirestore}
    />
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
      on:valueupdate={saveUpdateToFirestore}
    />
  {/if}
</div>
