<script lang="ts">
  import { EntryFields, type EntryFieldValue, type ExpandedEntry, type IDictionary, type SupaEntry } from '@living-dictionaries/types';
  import { page } from '$app/stores';
  import EntryField from './EntryField.svelte';
  import { createEventDispatcher } from 'svelte';
  import EntryDialect from '$lib/components/entry/EntryDialect.svelte';
  import { DICTIONARIES_WITH_VARIANTS } from '$lib/constants';
  import EntryMedia from './EntryMedia.svelte';
  import SelectSource from '$lib/components/entry/EntrySource.svelte';
  import { Button } from 'svelte-pieces';
  import Sense from './Sense.svelte';
  import type { DbOperations } from './+page';

  export let entry: ExpandedEntry;
  export let supaEntry: SupaEntry;
  export let dictionary: IDictionary;
  export let canEdit = false;
  export let videoAccess = false;
  export let admin: number;
  export let dbOperations: DbOperations;

  const dispatch = createEventDispatcher<{
    valueupdate: { field: string; newValue: string | string[] };
  }>();

  const regularFields: EntryFieldValue[] = ['plural_form', 'morphology', 'interlinearization', 'notes']

  async function addSense() {
    await dbOperations.updateSense({entry_id: entry.id, column: 'glosses', new_value: '{}', sense_id: window.crypto.randomUUID()})
  }
  async function deleteSense(sense_id: string) {
    await dbOperations.updateSense({entry_id: entry.id, column: 'deleted', new_value: new Date().toISOString(), sense_id})
  }
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

    {#if !supaEntry?.senses?.length}
      <Sense sense={entry.senses[0]} {canEdit} glossLanguages={dictionary.glossLanguages} on:valueupdate />

      {#if admin && canEdit}
        <button type="button" class="text-start p-2 mb-2 rounded order-2 hover:bg-gray-100 text-gray-600" on:click={addSense}><span class="i-system-uicons-versions text-xl" /> Add Sense</button>
      {/if}
    {:else}
      <div class="p-2 hover:bg-gray-50 rounded">
        <div class="font-semibold mb-2 flex">
          <div class="font-semibold">
            Sense 1
          </div>
        </div>
        <div class="flex flex-col border-s-2 ps-3 ms-1">
          <Sense sense={entry.senses[0]} {canEdit} glossLanguages={dictionary.glossLanguages} on:valueupdate />
        </div>
      </div>

      {#each supaEntry.senses as sense, index}
        <div class="p-2 hover:bg-gray-50 rounded">
          {#if canEdit}
            <div class="font-semibold mb-2 flex">
              <div class="font-semibold">
                Sense {index + 2}
              </div>
              <div class="mx-auto" />
              {#if canEdit}
                <!-- {#if index > 0}
              <Button size="sm" form="menu" onclick={() => alert('Re-ordering not ready yet.')}><span class="i-fa-chevron-up -mt-1" /></Button>
            {/if}
            {#if index < entry.senses.length - 1}
              <Button size="sm" form="menu" onclick={() => alert('Re-ordering not ready yet.')}><span class="i-fa-chevron-down -mt-1" /></Button>
            {/if} -->
                <Button class="text-gray-500!" size="sm" form="menu" onclick={() => deleteSense(sense.id)}><span class="i-fa-solid-times -mt-1" /></Button>
                <Button class="text-gray-500!" size="sm" form="menu" onclick={addSense}><span class="i-fa-solid-plus -mt-1" /></Button>
              {/if}
            </div>
          {/if}

          <div class="flex flex-col border-s-2 ps-3 ms-1">
            <pre>{JSON.stringify(sense, null, 2)}</pre>
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

<style>
  .media-on-right-grid {
      grid-template-columns: 3fr 1fr;
      grid-template-areas:
        'title media'
        'content media';
    }
</style>
