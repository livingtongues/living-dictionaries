<script lang="ts">
  import type { IDictionary, SenseWithSentences, TablesUpdate } from '@living-dictionaries/types'
  import EntryField from './EntryField.svelte'
  import { page } from '$app/stores'
  import { order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses'
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte'
  import EntrySemanticDomains from '$lib/components/entry/EntrySemanticDomains.svelte'
  import type { DbOperations } from '$lib/dbOperations'

  export let entryId: string
  export let sense: Partial<SenseWithSentences>
  export let glossLanguages: IDictionary['glossLanguages']
  export let can_edit = false
  export let update_sense: DbOperations['update_sense']
  export let update_sentence: DbOperations['update_sentence']

  function update(sense: TablesUpdate<'senses'>) {
    update_sense({ sense, entry_id: entryId, sense_id: sense.id })
  }

  const writing_systems = ['default']

  $: glossingLanguages = order_entry_and_dictionary_gloss_languages(sense.glosses, glossLanguages)
  $: hasSemanticDomain = sense.semantic_domains?.length || sense.write_in_semantic_domains?.length
</script>

{#each glossingLanguages as bcp}
  <EntryField
    value={sense.glosses?.[bcp]}
    field="gloss"
    {bcp}
    {can_edit}
    display={`${$page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}: ${$page.data.t('entry_field.gloss')}`}
    on_update={new_value => update({
      glosses: { ...sense.glosses, [bcp]: new_value },
    })} />
{/each}

<!-- Only in Bahasa Lani (id: jaRhn6MAZim4Blvr1iEv) -->
{#if sense.definition}
  <EntryField
    value={sense.definition?.en}
    field="definition_english"
    display="Definition (deprecated)"
    {can_edit}
    on_update={new_value => update({
      definition: new_value ? { en: new_value } : null,
    })} />
{/if}

{#if sense.parts_of_speech?.length || can_edit}
  <div class="md:px-2" class:order-2={!sense.parts_of_speech?.length}>
    <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.parts_of_speech')}</div>
    <EntryPartOfSpeech
      value={sense.parts_of_speech}
      {can_edit}
      on_update={new_value => update({
        parts_of_speech: new_value,
      })} />
    <div class="border-b-2 pb-1 mb-2 border-dashed" />
  </div>
{/if}

{#if hasSemanticDomain || can_edit}
  <div class="md:px-2" class:order-2={!hasSemanticDomain}>
    <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.semantic_domains')}</div>
    <EntrySemanticDomains
      {can_edit}
      semantic_domain_keys={sense.semantic_domains}
      write_in_semantic_domains={sense.write_in_semantic_domains}
      on_update={new_value => update({
        semantic_domains: new_value,
      })}
      on_update_write_in={new_value => update({
        write_in_semantic_domains: new_value,
      })} />
    <div class="border-b-2 pb-1 mb-2 border-dashed" />
  </div>
{/if}

<EntryField
  value={sense.noun_class}
  field="noun_class"
  {can_edit}
  display={$page.data.t('entry_field.noun_class')}
  on_update={new_value => update({
    noun_class: new_value || null,
  })} />

{#each sense.sentences || [{ text: {}, id: null, translation: null }] as sentence}
  {@const has_sentences = Object.keys(sentence.text).length}
  <div class:order-2={!has_sentences} class="flex flex-col">
    {#each writing_systems as orthography}
      <EntryField
        value={sentence.text[orthography]}
        field="example_sentence"
        {can_edit}
        display={$page.data.t('entry_field.example_sentence')}
        on_update={new_value => update_sentence({
          sentence: { [orthography]: new_value || null },
          sentence_id: sentence.id || window.crypto.randomUUID(),
          sense_id: sense.id,
        })} />
    {/each}

    {#if has_sentences}
      {#each glossingLanguages as bcp}
        <EntryField
          value={sentence.translation?.[bcp]}
          field="example_sentence"
          {bcp}
          {can_edit}
          display="{$page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}: {$page.data.t('entry_field.example_sentence')}"
          on_update={new_value => update_sentence({
            sentence: {
              translation: {
                ...sentence.translation,
                [bcp]: new_value,
              },
            },
            sentence_id: sentence.id,
            sense_id: sense.id,
          })} />
      {/each}
    {/if}
  </div>
{/each}
