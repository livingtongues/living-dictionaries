<script lang="ts">
  import { page } from '$app/stores';
  import type { IDictionary } from '@living-dictionaries/types';
  import { order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses';
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte';
  import SupaEntrySemanticDomains from '$lib/components/entry/SupaEntrySemanticDomains.svelte';
  import EntryField from './EntryField.svelte';
  import type { DbOperations } from '$lib/dbOperations';
  import { stringifyArray } from '$lib/supabase/stringifyArray';
  import type { SupaSense } from '$lib/supabase/database.types';

  export let entryId: string;
  export let sense: SupaSense
  export let glossLanguages: IDictionary['glossLanguages']
  export let can_edit = false;
  export let update_sense: DbOperations['update_sense'];
  export let update_sentence: DbOperations['update_sentence'];

  $: glossingLanguages = order_entry_and_dictionary_gloss_languages(sense.glosses, glossLanguages)
  $: hasSemanticDomain = sense.semantic_domains?.length || sense.write_in_semantic_domains?.length
</script>

{#each glossingLanguages as bcp}
  <EntryField
    value={sense.glosses?.[bcp]}
    field="gloss"
    {bcp}
    canEdit={can_edit}
    display={`${$page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp})}: ${$page.data.t('entry_field.gloss')}`}
    on_update={new_value => update_sense({
      column: 'glosses',
      entry_id: entryId,
      sense_id: sense.id,
      new_value: JSON.stringify({...sense.glosses, [bcp]: new_value}),
      old_value: JSON.stringify(sense.glosses)
    })} />
{/each}

<!-- Only in Bahasa Lani (id: jaRhn6MAZim4Blvr1iEv) -->
{#if sense.definition}
  <EntryField
    value={sense.definition?.en}
    field="definition_english"
    display="Definition (deprecated)"
    canEdit={can_edit}
    on_update={new_value => update_sense({
      column: 'definition',
      entry_id: entryId,
      sense_id: sense.id,
      new_value: new_value ? JSON.stringify({en: new_value}) : null,
      old_value: JSON.stringify(sense.definition),
    })} />
{/if}

{#if sense.parts_of_speech?.length || can_edit}
  <div class="md:px-2" class:order-2={!sense.parts_of_speech?.length}>
    <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.parts_of_speech')}</div>
    <EntryPartOfSpeech
      value={sense.parts_of_speech}
      canEdit={can_edit}
      on_update={new_value => update_sense({
        column: 'parts_of_speech',
        entry_id: entryId,
        sense_id: sense.id,
        new_value: stringifyArray(new_value),
        old_value: stringifyArray(sense.parts_of_speech),
      })} />
    <div class="border-b-2 pb-1 mb-2 border-dashed" />
  </div>
{/if}

{#if hasSemanticDomain || can_edit}
  <div class="md:px-2" class:order-2={!hasSemanticDomain}>
    <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.semantic_domains')}</div>
    <SupaEntrySemanticDomains
      {can_edit}
      semantic_domain_keys={sense.semantic_domains}
      write_in_semantic_domains={sense.write_in_semantic_domains}
      on_update={new_value => update_sense({
        column: 'semantic_domains',
        entry_id: entryId,
        sense_id: sense.id,
        new_value: stringifyArray(new_value),
        old_value: stringifyArray(sense.semantic_domains),
      })}
      on_update_write_in={new_value => update_sense({
        column: 'write_in_semantic_domains',
        entry_id: entryId,
        sense_id: sense.id,
        new_value: stringifyArray(new_value),
        old_value: stringifyArray(sense.write_in_semantic_domains),
      })} />
    <div class="border-b-2 pb-1 mb-2 border-dashed" />
  </div>
{/if}

<EntryField
  value={sense.noun_class}
  field="noun_class"
  canEdit={can_edit}
  display={$page.data.t('entry_field.noun_class')}
  on_update={new_value => update_sense({
    column: 'noun_class',
    entry_id: entryId,
    sense_id: sense.id,
    new_value: new_value || null,
    old_value: sense.noun_class,
  })} />

{#each sense.sentences || [{text: null, id: null, translation: null}] as sentence}
  <EntryField
    value={sentence.text}
    field="example_sentence"
    canEdit={can_edit}
    display={$page.data.t('entry_field.example_sentence')}
    on_update={new_value => update_sentence({
      column: 'text',
      sentence_id: sentence.id || window.crypto.randomUUID(),
      sense_id: sense.id,
      new_value: new_value || null,
      old_value: sentence.text,
    })} />

  {#if sentence.text}
    {#each glossingLanguages as bcp}
      <EntryField
        value={sentence.translation?.[bcp]}
        field="example_sentence"
        {bcp}
        canEdit={can_edit}
        display="{$page.data.t({dynamicKey: `gl.${bcp}`, fallback: bcp})}: {$page.data.t('entry_field.example_sentence')}"
        on_update={new_value => update_sentence({
          column: 'translation',
          sentence_id: sentence.id,
          sense_id: sense.id,
          new_value: JSON.stringify({...sentence.translation, [bcp]: new_value}),
          old_value: JSON.stringify(sentence.translation),
        })} />
    {/each}
  {/if}
{/each}
