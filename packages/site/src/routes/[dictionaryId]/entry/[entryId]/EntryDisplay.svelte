<script lang="ts">
  import { t } from 'svelte-i18n';
  import type { IDictionary, IEntry } from '@living-dictionaries/types';
  import EntryField from './EntryField.svelte';
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte';
  import EntrySemanticDomains from './EntrySemanticDomains.svelte';
  import EntryDialect from './EntryDialect.svelte';
  import { BadgeArray } from 'svelte-pieces';
  import EntryMedia from './EntryMedia.svelte';
  import { createEventDispatcher } from 'svelte';
  import { order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses';

  export let entry: IEntry;
  export let dictionary: IDictionary;
  export let canEdit = false;
  export let videoAccess = false;

  $: glossingLanguages = order_entry_and_dictionary_gloss_languages(
    entry.gl,
    dictionary.glossLanguages || ['en']
  );

  const dispatch = createEventDispatcher<{
    valueupdate: { field: string; newValue: string[] }; // an array of strings for the sr field, but the valueupdate events being passed upwards are mostly strings
  }>();
</script>

<div class="flex flex-col md:flex-row-reverse mb-3">
  <div class="md:hidden" dir="ltr">
    <EntryField
      value={entry.lx}
      field="lx"
      {canEdit}
      display={$t('entry.lx', { default: 'Lexeme/Word/Phrase' })}
      on:valueupdate />
  </div>

  <div class="md:w-1/3 flex flex-col md:flex-col-reverse justify-end mt-2">
    <EntryMedia {entry} {canEdit} {videoAccess} on:deleteImage on:deleteVideo />
  </div>

  <div class="hidden md:block w-1" />

  <div class="md:w-2/3 flex flex-col">
    <div class="hidden md:block">
      <EntryField
        value={entry.lx}
        field="lx"
        {canEdit}
        display={$t('entry.lx', { default: 'Lexeme/Word/Phrase' })}
        on:valueupdate />
    </div>

    {#each dictionary.alternateOrthographies || [] as orthography, index}
      <EntryField
        value={entry[index === 0 ? 'lo' : `lo${index + 1}`]}
        field={index === 0 ? 'lo' : `lo${index + 1}`}
        {canEdit}
        display={orthography}
        on:valueupdate />
    {/each}

    <EntryField value={entry.ph} field="ph" {canEdit} display={$t('entry.ph')} on:valueupdate />

    {#each glossingLanguages as bcp}
      <EntryField
        value={entry.gl?.[bcp]}
        field={`gl.${bcp}`}
        {canEdit}
        display={`${$t(`gl.${bcp}`)}: ${$t('entry.gloss', {
          default: 'Gloss',
        })}`}
        on:valueupdate />
    {/each}

    <!-- Only in Bahasa Lani (id: jaRhn6MAZim4Blvr1iEv) -->
    {#if entry.de}
      <EntryField
        value={entry.de}
        field="de"
        {canEdit}
        display="Definition (deprecated)"
        on:valueupdate />
    {/if}

    {#if entry.ps?.length || canEdit}
      <div class="md:px-2" class:order-2={!entry.ps?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$t('entry.ps')}</div>
        <EntryPartOfSpeech value={entry.ps} {canEdit} on:valueupdate />
        <div class="border-b-2 pb-1 mb-2" />
      </div>
    {/if}

    <EntrySemanticDomains {canEdit} {entry} on:valueupdate />

    <EntryDialect {canEdit} value={entry.di?.[0]} on:valueupdate />

    <EntryField
      value={entry.scn?.[0]}
      field="scn"
      {canEdit}
      display={$t('entry.scn', { default: 'Scientific Name' })}
      on:valueupdate={({ detail }) =>
        dispatch('valueupdate', { field: 'scn', newValue: [detail.newValue] })} />

    {#if ['babanki', 'torwali'].includes(dictionary.id)}
      <EntryField
        value={entry['va']}
        field="va"
        {canEdit}
        display={$t(`entry.va`, { default: 'Variant' })}
        on:valueupdate />
    {/if}

    {#each ['pl', 'nc', 'mr', 'in', 'nt'] as field}
      <EntryField
        value={entry[field]}
        {field}
        {canEdit}
        display={$t(`entry.${field}`)}
        on:valueupdate />
    {/each}

    {#if entry.sr?.length || canEdit}
      <div class="md:px-2" class:order-2={!entry.sr?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$t('entry.sr')}</div>
        <BadgeArray
          strings={typeof entry.sr === 'string' ? [entry.sr] : entry.sr || []}
          {canEdit}
          promptMessage={$t('entry.sr')}
          addMessage={$t('misc.add', { default: 'Add' })}
          on:valueupdated={(e) => dispatch('valueupdate', { field: 'sr', newValue: e.detail })} />
        <div class="border-b-2 pb-1 mb-2" />
      </div>
    {/if}

    <!-- used for old dictionary imports, needs refactored into entry.xs -->
    {#if entry.xv}
      <EntryField
        value={entry.xv}
        field="xv"
        {canEdit}
        display={$t('entry.example_sentence', { default: 'Example Sentence' })}
        on:valueupdate />
    {/if}

    <EntryField
      value={entry.xs && entry.xs.vn}
      field="xs.vn"
      {canEdit}
      display={$t('entry.example_sentence', { default: 'Example Sentence' })}
      on:valueupdate />

    {#each glossingLanguages as bcp}
      <EntryField
        value={entry.xs && entry.xs[bcp]}
        field={`xs.${bcp}`}
        {canEdit}
        display={`${$t(`gl.${bcp}`)}: ${$t('entry.example_sentence', {
          default: 'Example Sentence',
        })}`}
        on:valueupdate />
    {/each}
  </div>
</div>
