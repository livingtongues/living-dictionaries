<script lang="ts">
  import { page } from '$app/stores';
  import type { IDictionary } from '@living-dictionaries/types';
  import { order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses';
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte';
  import SupaEntrySemanticDomains from '$lib/components/entry/SupaEntrySemanticDomains.svelte';
  import EntryField from './EntryField.svelte';
  import type { DbOperations } from '$lib/dbOperations';
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
      change: {
        glosses: {
          new: { ...sense.glosses, [bcp]: new_value },
          old: sense.glosses,
        }
      },
      entry_id: entryId,
      sense_id: sense.id,
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
      change: {
        definition: {
          new: new_value ? {en: new_value} : null,
          old: sense.definition,
        }
      },
      entry_id: entryId,
      sense_id: sense.id,
    })} />
{/if}

{#if sense.parts_of_speech?.length || can_edit}
  <div class="md:px-2" class:order-2={!sense.parts_of_speech?.length}>
    <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.parts_of_speech')}</div>
    <EntryPartOfSpeech
      value={sense.parts_of_speech}
      canEdit={can_edit}
      on_update={new_value => update_sense({
        change: {
          parts_of_speech: {
            new: new_value,
            old: sense.parts_of_speech,
          }
        },
        entry_id: entryId,
        sense_id: sense.id,
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
        change: {
          semantic_domains: {
            new: new_value,
            old: sense.semantic_domains,
          }
        },
        entry_id: entryId,
        sense_id: sense.id,
      })}
      on_update_write_in={new_value => update_sense({
        change: {
          write_in_semantic_domains: {
            new: new_value,
            old: sense.write_in_semantic_domains,
          }
        },
        entry_id: entryId,
        sense_id: sense.id,
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
    change: {
      noun_class: {
        new: new_value || null,
        old: sense.noun_class || null,
      }
    },
    entry_id: entryId,
    sense_id: sense.id,
  })} />

{#each sense.sentences || [{text: null, id: null, translation: null}] as sentence}
  <EntryField
    value={sentence.text}
    field="example_sentence"
    canEdit={can_edit}
    display={$page.data.t('entry_field.example_sentence')}
    on_update={new_value => update_sentence({
      change: {
        text: {
          new: { default: new_value || null },
          old: sentence.text ? { default: sentence.text } : null,
        }
      },
      sentence_id: sentence.id || window.crypto.randomUUID(),
      sense_id: sense.id,
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
          change: {
            translation: {
              new: {
                ...sentence.translation,
                [bcp]: new_value
              },
              old: sentence.translation,
            }
          },
          sentence_id: sentence.id,
          sense_id: sense.id,
        })} />
    {/each}
  {/if}
{/each}
