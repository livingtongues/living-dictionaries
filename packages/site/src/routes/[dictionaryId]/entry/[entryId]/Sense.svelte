<script lang="ts">
  import { page } from '$app/stores';
  import { EntryFields, type ExpandedSense, type IDictionary } from '@living-dictionaries/types';
  import { order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses';
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte';
  import EntrySemanticDomains from '$lib/components/entry/EntrySemanticDomains.svelte';
  import EntryField from './EntryField.svelte';
  import { createEventDispatcher } from 'svelte';

  export let sense: ExpandedSense
  export let glossLanguages: IDictionary['glossLanguages']
  export let canEdit = false;

  const dispatch = createEventDispatcher<{
    valueupdate: { field: string; newValue: string | string[] };
  }>();

  $: glossingLanguages = order_entry_and_dictionary_gloss_languages(sense.glosses, glossLanguages)

  $: hasSemanticDomain = sense.translated_ld_semantic_domains?.length || sense.write_in_semantic_domains?.length
</script>

{#each glossingLanguages as bcp}
  <EntryField
    value={sense.glosses?.[bcp]}
    field="gloss"
    {bcp}
    {canEdit}
    display={`${$page.data.t(`gl.${bcp}`)}: ${$page.data.t('entry.gloss')}`}
    on:update={({detail}) => dispatch('valueupdate', { field: `gl.${bcp}`, newValue: detail})} />
{/each}

<!-- Only in Bahasa Lani (id: jaRhn6MAZim4Blvr1iEv) -->
{#if sense.definition_english}
  <EntryField
    value={sense.definition_english}
    field="definition_english"
    {canEdit}
    display="Definition (deprecated)"
    on:update={({detail}) => dispatch('valueupdate', { field: EntryFields.definition_english, newValue: detail})} />
{/if}

{#if sense.translated_parts_of_speech?.length || canEdit}
  <div class="md:px-2" class:order-2={!sense.translated_parts_of_speech?.length}>
    <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry.ps')}</div>
    <EntryPartOfSpeech value={sense.translated_parts_of_speech} {canEdit} on:valueupdate />
    <div class="border-b-2 pb-1 mb-2 border-dashed" />
  </div>
{/if}

{#if hasSemanticDomain || canEdit}
  <div class="md:px-2" class:order-2={!hasSemanticDomain}>
    <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry.sdn')}</div>
    <EntrySemanticDomains {canEdit} {sense} on:valueupdate />
    <div class="border-b-2 pb-1 mb-2 border-dashed" />
  </div>
{/if}

<EntryField
  value={sense.noun_class}
  field="noun_class"
  {canEdit}
  display={$page.data.t('entry.nc')}
  on:update={({detail}) => dispatch('valueupdate', { field: EntryFields.noun_class, newValue: detail})} />

{#each sense.example_sentences || [{}] as sentence}
  <EntryField
    value={sentence.vn}
    field="example_sentence"
    {canEdit}
    display={$page.data.t('entry.example_sentence')}
    on:update={({detail}) => dispatch('valueupdate', { field: 'xs.vn', newValue: detail})} />

  {#each glossingLanguages as bcp}
    <EntryField
      value={sentence[bcp]}
      field="example_sentence"
      {bcp}
      {canEdit}
      display={`${$page.data.t(`gl.${bcp}`)}: ${$page.data.t('entry.example_sentence')}`}
      on:update={({detail}) => dispatch('valueupdate', { field: `xs.${bcp}`, newValue: detail})} />
  {/each}
{/each}
