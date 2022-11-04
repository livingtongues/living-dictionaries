<script lang="ts">
  import { t } from 'svelte-i18n';
  import type { IEntry } from '@living-dictionaries/types';
  import EntryField from './EntryField.svelte';
  import EntryPartOfSpeech from '@living-dictionaries/parts/src/lib/entries/entry/EntryPartOfSpeech.svelte';
  import EntrySemanticDomains from './EntrySemanticDomains.svelte';
  import EntryDialect from './EntryDialect.svelte';
  import BadgeArray from 'svelte-pieces/data/BadgeArray.svelte';
  import EntryMedia from './EntryMedia.svelte';
  import InstantSearch from '$lib/components/search/InstantSearch.svelte';
  import { dictionary } from '$lib/stores';
  import { browser } from '$app/environment';

  export let entry: IEntry,
    videoAccess = false,
    canEdit = false,
    alternateOrthographies = [],
    glossingLanguages = ['en'];

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    valueupdate: { field: string; newValue: string[] }; // an array of strings for the sr field, but the valueupdate events being passed upwards are mostly strings
  }>();
</script>

<div class="flex flex-col md:flex-row-reverse mb-3">
  <div class="md:hidden" dir="ltr">
    <EntryField
      {t}
      value={entry.lx}
      field="lx"
      {canEdit}
      display={$t('entry.lx', { default: 'Lexeme/Word/Phrase' })}
      on:valueupdate />
  </div>

  <div class="md:w-1/3 flex flex-col md:flex-col-reverse justify-end mt-2">
    <EntryMedia {entry} {canEdit} {videoAccess} />
  </div>

  <div class="hidden md:block w-1" />

  <div class="md:w-2/3 flex flex-col">
    <div class="hidden md:block">
      <EntryField
        {t}
        value={entry.lx}
        field="lx"
        {canEdit}
        display={$t('entry.lx', { default: 'Lexeme/Word/Phrase' })}
        on:valueupdate />
    </div>

    {#each alternateOrthographies as orthography, index}
      <EntryField
        {t}
        value={entry[index === 0 ? 'lo' : `lo${index + 1}`]}
        field={index === 0 ? 'lo' : `lo${index + 1}`}
        {canEdit}
        display={orthography}
        on:valueupdate />
    {/each}

    <EntryField {t} value={entry.ph} field="ph" {canEdit} display={$t('entry.ph')} on:valueupdate />

    {#each glossingLanguages as bcp}
      <EntryField
        {t}
        value={entry.gl[bcp]}
        field={`gl.${bcp}`}
        {canEdit}
        display={`${$t(`gl.${bcp}`)} ${$t('entry.gloss', {
          default: 'Gloss',
        })}`}
        on:valueupdate />
    {/each}

    {#if entry.de}
      <!-- Only in Bahasa Lani (id: jaRhn6MAZim4Blvr1iEv) -->
      <EntryField
        {t}
        value={entry.de}
        field="de"
        {canEdit}
        display="Definition (deprecated)"
        on:valueupdate />
    {/if}

    {#if entry.ps?.length || canEdit}
      <div class="md:px-2" class:order-2={!entry.ps?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$t('entry.ps')}</div>
        <EntryPartOfSpeech {t} value={entry.ps} {canEdit} on:valueupdate />
        <div class="border-b-2 pb-1 mb-2" />
      </div>
    {/if}

    <EntrySemanticDomains {canEdit} {entry} on:valueupdate />

    {#if $dictionary.id === 'babanki'}
      <EntryField
        {t}
        value={entry['va']}
        field="va"
        {canEdit}
        display={$t(`entry.va`, { default: 'Variant' })}
        on:valueupdate />
    {/if}

    {#if browser}  
      <InstantSearch dictionaryId={$dictionary.id} let:search>
        <EntryDialect {search} {canEdit} {entry} on:valueupdate />
      </InstantSearch>
    {/if}
    
    {#each ['pl', 'nc', 'mr', 'in', 'nt'] as field}
      <EntryField
        {t}
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
          strings={entry.sr || []}
          {canEdit}
          promptMessage={$t('entry.sr')}
          addMessage={$t('misc.add', { default: 'Add' })}
          on:valueupdated={(e) => dispatch('valueupdate', { field: 'sr', newValue: e.detail })} />
        <div class="border-b-2 pb-1 mb-2" />
      </div>
    {/if}

    {#if entry.xv}
      <!-- used for old dictionary imports, needs refactored into entry.xs -->
      <EntryField
        {t}
        value={entry.xv}
        field="xv"
        {canEdit}
        display={$t('entry.example_sentence', { default: 'Example Sentence' })}
        on:valueupdate />
    {/if}

    <EntryField
      {t}
      value={entry.xs && entry.xs.vn}
      field="xs.vn"
      {canEdit}
      display={$t('entry.example_sentence', { default: 'Example Sentence' })}
      on:valueupdate />

    {#each glossingLanguages as bcp}
      <EntryField
        {t}
        value={entry.xs && entry.xs[bcp]}
        field={`xs.${bcp}`}
        {canEdit}
        display={`${$t(`gl.${bcp}`)} ${$t('entry.example_sentence', {
          default: 'Example Sentence',
        })}`}
        on:valueupdate />
    {/each}
  </div>
</div>
