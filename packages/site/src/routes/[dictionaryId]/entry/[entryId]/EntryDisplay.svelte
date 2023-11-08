<script lang="ts">
  import { EntryFields, type EntryFieldValue, type ExpandedEntry, type IDictionary, type Change } from '@living-dictionaries/types';
  import { page } from '$app/stores';
  import EntryField from './EntryField.svelte';
  import { createEventDispatcher } from 'svelte';
  import EntryDialect from '$lib/components/entry/EntryDialect.svelte';
  import { DICTIONARIES_WITH_VARIANTS } from '$lib/constants';
  import EntryMedia from './EntryMedia.svelte';
  import SelectSource from '$lib/components/entry/EntrySource.svelte';
  import EntryHistory from './EntryHistory.svelte';
  import { Button } from 'svelte-pieces';
  import Sense from './Sense.svelte';

  export let entry: ExpandedEntry;
  export let dictionary: IDictionary;
  export let canEdit = false;
  export let videoAccess = false;
  export let history: Change[] = undefined;
  export let admin: number;

  const dispatch = createEventDispatcher<{
    valueupdate: { field: string; newValue: string | string[] };
  }>();

  const regularFields: EntryFieldValue[] = ['plural_form', 'morphology', 'interlinearization', 'notes']
</script>

<div class="flex flex-col md:grid mb-3 media-on-right-grid grid-gap-2">
  <div dir="ltr" style="grid-area: title;">
    <EntryField
      value={entry.lexeme}
      field="lexeme"
      {canEdit}
      display={$page.data.t('entry_field.lexeme')}
      on:update={({detail}) => dispatch('valueupdate', { field: EntryFields.lexeme, newValue: detail})} />
  </div>

  <div style="grid-area: media;">
    <EntryMedia {dictionary} {entry} {canEdit} {videoAccess} on:deleteImage on:deleteVideo on:valueupdate />
    {#if history?.length > 0}<EntryHistory {history} {canEdit} class="mt-5 hidden md:block" />{/if}
  </div>

  <div class="flex flex-col grow" style="grid-area: content;">
    {#each dictionary.alternateOrthographies || [] as orthography, index}
      {@const orthographyIndex = `local_orthography_${index + 1}`}
      <EntryField
        value={entry[orthographyIndex]}
        field="local_orthography"
        {canEdit}
        display={orthography}
        on:update={({detail}) => dispatch('valueupdate', { field: orthographyIndex, newValue: detail})} />
    {/each}

    <EntryField value={entry.phonetic} field="phonetic" {canEdit} display={$page.data.t('entry_field.phonetic')} on:update={({detail}) => dispatch('valueupdate', { field: EntryFields.phonetic, newValue: detail})} />

    {#if entry.senses.length < 2}
      <Sense sense={entry.senses[0]} {canEdit} glossLanguages={dictionary.glossLanguages} on:valueupdate />

      {#if admin && canEdit}
        <button type="button" class="text-start p-2 mb-2 rounded order-2 hover:bg-gray-100 text-gray-600" on:click={() => alert('Ability to add additional senses coming soon.')}><span class="i-system-uicons-versions text-xl" /> Add Sense</button>
      {/if}
    {:else}
      {#each entry.senses as sense, index}
        <div class="p-2 hover:bg-gray-50 rounded">

          {#if entry.senses.length > 1 || canEdit}
            <div class="font-semibold mb-2 flex">
              <div class="font-semibold">
                Sense {index + 1}
              </div>
              <div class="mx-auto" />
              {#if canEdit}
                <!-- {#if index > 0}
              <Button size="sm" form="menu" onclick={() => alert('Re-ordering not ready yet.')}><span class="i-fa-chevron-up -mt-1" /></Button>
            {/if}
            {#if index < entry.senses.length - 1}
              <Button size="sm" form="menu" onclick={() => alert('Re-ordering not ready yet.')}><span class="i-fa-chevron-down -mt-1" /></Button>
            {/if} -->
                {#if entry.senses.length > 1}
                  <Button class="text-gray-500!" size="sm" form="menu" onclick={() => alert('Delete sense feature coming.')}><span class="i-fa-solid-times -mt-1" /></Button>
                {/if}
                <Button class="text-gray-500!" size="sm" form="menu" onclick={() => alert('Ability to add additional senses coming soon.')}><span class="i-fa-solid-plus -mt-1" /></Button>
              {/if}
            </div>
          {/if}

          <div class="flex flex-col border-s-2 ps-3 ms-1">
            <Sense {sense} {canEdit} glossLanguages={dictionary.glossLanguages} on:valueupdate />
          </div>
        </div>
      {/each}
    {/if}

    {#if entry.dialects?.length || canEdit}
      <div class="md:px-2" class:order-2={!entry.dialects?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.dialects')}</div>
        <EntryDialect {canEdit} dialects={entry.dialects} dictionaryId={dictionary.id} on:valueupdate />
        <div class="border-b-2 pb-1 mb-2 border-dashed" />
      </div>
    {/if}

    <!-- TODO: make multiple with generic component -->
    <EntryField
      value={entry.scientific_names?.[0]}
      field="scientific_names"
      {canEdit}
      display={$page.data.t('entry_field.scientific_names')}
      on:update={({ detail }) => dispatch('valueupdate', { field: EntryFields.scientific_names, newValue: [detail] })} />

    {#if DICTIONARIES_WITH_VARIANTS.includes(dictionary.id)}
      <EntryField
        value={entry.variant}
        field="variant"
        {canEdit}
        display={$page.data.t('entry_field.variant')}
        on:update={({detail}) => dispatch('valueupdate', { field: EntryFields.variant, newValue: detail})} />
    {/if}

    {#each regularFields as field}
      <EntryField
        value={entry[field]}
        {field}
        {canEdit}
        display={$page.data.t(`entry_field.${field}`)}
        on:update={({detail}) => dispatch('valueupdate', { field: EntryFields[field], newValue: detail})} />
    {/each}

    {#if entry.sources?.length || canEdit}
      <div class="md:px-2" class:order-2={!entry.sources?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.sources')}</div>
        <SelectSource
          {canEdit}
          value={entry.sources}
          on:valueupdate />
        <div class="border-b-2 pb-1 mb-2 border-dashed" />
      </div>
    {/if}
  </div>
</div>

{#if history?.length > 0}<EntryHistory {history} {canEdit} class="mt-3 md:hidden" />{/if}
<style>
  .media-on-right-grid {
      grid-template-columns: 3fr 1fr;
      grid-template-areas:
        'title media'
        'content media';
    }
</style>
