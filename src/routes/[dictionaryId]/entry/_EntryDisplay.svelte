<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IEntry } from '$lib/interfaces';
  import EntryField from './_EntryField.svelte';
  import EntryPartOfSpeech from './_EntryPartOfSpeech.svelte';
  import EntrySemanticDomains from './_EntrySemanticDomains.svelte';
  import BadgeArray from '$svelteui/data/BadgeArray.svelte';
  import EntryMedia from './_EntryMedia.svelte';

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
      value={entry.lx}
      field="lx"
      {canEdit}
      display={$_('entry.lx', { default: 'Lexeme/Word/Phrase' })}
      on:valueupdate />
  </div>

  <div class="md:w-1/3 flex flex-col md:flex-col-reverse justify-end mt-2">
    <EntryMedia {entry} {canEdit} {videoAccess} />
  </div>

  <div class="hidden md:block w-1" />

  <div class="md:w-2/3 flex flex-col">
    <div class="hidden md:block">
      <EntryField
        value={entry.lx}
        field="lx"
        {canEdit}
        display={$_('entry.lx', { default: 'Lexeme/Word/Phrase' })}
        on:valueupdate />
    </div>

    {#each alternateOrthographies as orthography, index}
      <EntryField
        value={entry[index === 0 ? 'lo' : `lo${index + 1}`]}
        field={index === 0 ? 'lo' : `lo${index + 1}`}
        {canEdit}
        display={orthography}
        on:valueupdate />
    {/each}

    {#each ['ph'] as field}
      <EntryField
        value={entry[field]}
        {field}
        {canEdit}
        display={$_(`entry.${field}`)}
        on:valueupdate />
    {/each}

    {#each glossingLanguages as bcp}
      <EntryField
        value={entry.gl[bcp]}
        field={`gl.${bcp}`}
        {canEdit}
        display={`${$_(`gl.${bcp}`)} ${$_('entry.gloss', {
          default: 'Gloss',
        })}`}
        on:valueupdate />
    {/each}

    {#if entry.de}
      <!-- Only in Bahasa Lani (id: jaRhn6MAZim4Blvr1iEv) -->
      <EntryField
        value={entry.de}
        field="de"
        {canEdit}
        display="Definition (deprecated)"
        on:valueupdate />
    {/if}

    <EntryPartOfSpeech
      value={entry.ps}
      {canEdit}
      display={$_('entry.ps', { default: 'Part of Speech' })}
      on:valueupdate />

    <EntrySemanticDomains {canEdit} {entry} on:valueupdate />

    {#each ['nc', 'va', 'mr', 'in', 'di', 'nt'] as field}
      <EntryField
        value={entry[field]}
        {field}
        {canEdit}
        display={$_(`entry.${field}`)}
        on:valueupdate />
    {/each}

    {#if (entry.sr && entry.sr.length) || canEdit}
      <div class="md:px-2" class:order-2={!(entry.sr && entry.sr.length)}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$_('entry.sr')}</div>
        <BadgeArray
          strings={entry.sr || []}
          {canEdit}
          promptMessage={$_('entry.sr')}
          addMessage={$_('misc.add', { default: 'Add' })}
          on:valueupdated={(e) => dispatch('valueupdate', { field: 'sr', newValue: e.detail })} />
        <div class="border-dashed border-b-2  pb-1 mb-2" />
      </div>
    {/if}

    {#if entry.xv}
      <!-- used for old dictionary imports, needs refactored into entry.xs -->
      <EntryField
        value={entry.xv}
        field="xv"
        {canEdit}
        display={$_('entry.example_sentence', { default: 'Example Sentence' })}
        on:valueupdate />
    {/if}

    <EntryField
      value={entry.xs && entry.xs.vn}
      field="xs.vn"
      {canEdit}
      display={$_('entry.example_sentence', { default: 'Example Sentence' })}
      on:valueupdate />

    {#each glossingLanguages as bcp}
      <EntryField
        value={entry.xs && entry.xs[bcp]}
        field={`xs.${bcp}`}
        {canEdit}
        display={`${$_(`gl.${bcp}`)} ${$_('entry.example_sentence', {
          default: 'Example Sentence',
        })}`}
        on:valueupdate />
    {/each}
  </div>
</div>
