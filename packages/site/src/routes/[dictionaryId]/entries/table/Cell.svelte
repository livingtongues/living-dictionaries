<script lang="ts">
  import { t } from 'svelte-i18n';
  import Textbox from './cells/Textbox.svelte';
  import SemanticDomains from './cells/SemanticDomains.svelte';
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte';
  import EntryDialect from '$lib/components/entry/EntryDialect.svelte';
  import SelectSpeakerCell from './cells/SelectSpeakerCell.svelte';
  import SelectSource from './cells/SelectSource.svelte';
  import Image from '$lib/components/image/Image.svelte';
  import { EntryFields, type ExpandedEntry, type IColumn } from '@living-dictionaries/types';
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
    {/if}
  {:else if column.field === 'speaker'}
    <SelectSpeakerCell {canEdit} {entry} />
  {:else if column.field === 'parts_of_speech'}
    <EntryPartOfSpeech
      {canEdit}
      value={entry.senses?.[0]?.translated_parts_of_speech}
      on:valueupdate />
  {:else if column.field === 'semantic_domains'}
    <SemanticDomains
      {canEdit}
      {entry}
      on:update={({detail}) => dispatch('valueupdate', { field: 'sdn', newValue: detail })}
      on:removeCustomDomain={() => dispatch('valueupdate', { field: 'sd', newValue: null })} />
  {:else if column.field === 'dialects'}
    <EntryDialect
      {canEdit}
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
      display={$t('entry.scn', { default: 'Scientific Name' })}
      on:update={({detail}) => dispatch('valueupdate', { field: EntryFields.scientific_names, newValue: [detail]} )} />
  {:else if column.field === 'local_orthography'}
    {@const orthographyIndex = `local_orthography_${column.orthography_index}`}
    <Textbox
      {canEdit}
      field={column.field}
      value={entry[orthographyIndex]}
      display={column.display}
      on:update={({detail}) => dispatch('valueupdate', { field: orthographyIndex, newValue: detail} )} />
  {:else}
    <Textbox
      field={column.field}
      {canEdit}
      value={entry[column.field]}
      display={$t(`entry.${EntryFields[column.field]}`, { default: 'Edit' })}
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

  div :global(button) {
    margin-bottom: 0px !important;
  }
</style>
