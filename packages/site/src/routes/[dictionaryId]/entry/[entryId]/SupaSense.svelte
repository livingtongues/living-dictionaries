<script lang="ts">
  import { page } from '$app/stores';
  import type { IDictionary, SupaEntry } from '@living-dictionaries/types';
  import { order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses';
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte';
  import SupaEntrySemanticDomains from '$lib/components/entry/SupaEntrySemanticDomains.svelte';
  import EntryField from './EntryField.svelte';
  import type { DbOperations } from '$lib/dbOperations';
  import { stringifyArray } from '$lib/supabase/stringifyArray';

  export let entryId: string;
  export let sense: SupaEntry['senses'][0]
  export let glossLanguages: IDictionary['glossLanguages']
  export let canEdit = false;
  export let updateSense: DbOperations['updateSense'];

  $: glossingLanguages = order_entry_and_dictionary_gloss_languages(sense.glosses, glossLanguages)
  $: hasSemanticDomain = sense.semantic_domains?.length || sense.write_in_semantic_domains?.length
</script>

{#each glossingLanguages as bcp}
  <EntryField
    value={sense.glosses?.[bcp]}
    field="gloss"
    {bcp}
    {canEdit}
    display={`${$page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp})}: ${$page.data.t('entry_field.gloss')}`}
    on:update={({detail}) => updateSense({
      column: 'glosses',
      entry_id: entryId,
      sense_id: sense.id,
      new_value: JSON.stringify({...sense.glosses, [bcp]: detail}),
      old_value: JSON.stringify(sense.glosses)
    })} />
{/each}

<!-- Only in Bahasa Lani (id: jaRhn6MAZim4Blvr1iEv) -->
{#if sense.definition_english_deprecated}
  <EntryField
    value={sense.definition_english_deprecated}
    field="definition_english"
    {canEdit}
    display="Definition (deprecated)"
    on:update={({detail}) => updateSense({
      column: 'definition',
      entry_id: entryId,
      sense_id: sense.id,
      new_value: detail || null,
      old_value: sense.definition_english_deprecated,
    })} />
{/if}

{#if sense.parts_of_speech?.length || canEdit}
  <div class="md:px-2" class:order-2={!sense.parts_of_speech?.length}>
    <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.parts_of_speech')}</div>
    <EntryPartOfSpeech
      value={sense.parts_of_speech}
      {canEdit}
      on:valueupdate={({detail: {newValue}}) => updateSense({
        column: 'parts_of_speech',
        entry_id: entryId,
        sense_id: sense.id,
        new_value: stringifyArray(newValue),
        old_value: stringifyArray(sense.parts_of_speech),
      })} />
    <div class="border-b-2 pb-1 mb-2 border-dashed" />
  </div>
{/if}

{#if hasSemanticDomain || canEdit}
  <div class="md:px-2" class:order-2={!hasSemanticDomain}>
    <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.semantic_domains')}</div>
    <SupaEntrySemanticDomains
      {canEdit}
      semanticDomainKeys={sense.semantic_domains}
      writeInSemanticDomains={sense.write_in_semantic_domains}
      on:update={({detail}) => updateSense({
        column: 'semantic_domains',
        entry_id: entryId,
        sense_id: sense.id,
        new_value: stringifyArray(detail),
        old_value: stringifyArray(sense.semantic_domains),
      })}
      on:updateWriteIn={({detail}) => updateSense({
        column: 'write_in_semantic_domains',
        entry_id: entryId,
        sense_id: sense.id,
        new_value: stringifyArray(detail),
        old_value: stringifyArray(sense.write_in_semantic_domains),
      })} />
    <div class="border-b-2 pb-1 mb-2 border-dashed" />
  </div>
{/if}

<EntryField
  value={sense.noun_class}
  field="noun_class"
  {canEdit}
  display={$page.data.t('entry_field.noun_class')}
  on:update={({detail}) => updateSense({
    column: 'noun_class',
    entry_id: entryId,
    sense_id: sense.id,
    new_value: detail || null,
    old_value: sense.noun_class,
  })} />
