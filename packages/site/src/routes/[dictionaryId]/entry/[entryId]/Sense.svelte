<script lang="ts">
  import { type ActualDatabaseEntry, EntryFields, type ExpandedSense, type IDictionary } from '@living-dictionaries/types'
  import EntryField from './EntryField.svelte'
  import { page } from '$app/stores'
  import { order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses'
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte'
  import SupaEntrySemanticDomains from '$lib/components/entry/SupaEntrySemanticDomains.svelte'

  export let sense: ExpandedSense
  export let glossLanguages: IDictionary['glossLanguages']
  export let can_edit = false
  export let updateEntry: (data: ActualDatabaseEntry & { 'xs.vn'?: string }) => void

  $: glossingLanguages = order_entry_and_dictionary_gloss_languages(sense.glosses, glossLanguages)
  $: hasSemanticDomain = sense.translated_ld_semantic_domains?.length || sense.write_in_semantic_domains?.length
</script>

{#each glossingLanguages as bcp}
  <EntryField
    value={sense.glosses?.[bcp]}
    field="gloss"
    {bcp}
    {can_edit}
    display={`${$page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}: ${$page.data.t('entry_field.gloss')}`}
    on_update={new_value => updateEntry({ [`gl.${bcp}`]: new_value })} />
{/each}

<!-- Only in Bahasa Lani (id: jaRhn6MAZim4Blvr1iEv) -->
{#if sense.definition_english}
  <EntryField
    value={sense.definition_english}
    field="definition_english"
    {can_edit}
    display="Definition (deprecated)"
    on_update={new_value => updateEntry({ [EntryFields.definition_english]: new_value })} />
{/if}

{#if sense.translated_parts_of_speech?.length || can_edit}
  <div class="md:px-2" class:order-2={!sense.translated_parts_of_speech?.length}>
    <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.parts_of_speech')}</div>
    <EntryPartOfSpeech
      value={sense.translated_parts_of_speech}
      {can_edit}
      on_update={new_value => updateEntry({ [EntryFields.parts_of_speech]: new_value })} />
    <div class="border-b-2 pb-1 mb-2 border-dashed" />
  </div>
{/if}

{#if hasSemanticDomain || can_edit}
  <div class="md:px-2" class:order-2={!hasSemanticDomain}>
    <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.semantic_domains')}</div>
    <SupaEntrySemanticDomains
      {can_edit}
      semantic_domain_keys={sense.ld_semantic_domains_keys}
      write_in_semantic_domains={sense.write_in_semantic_domains}
      on_update={new_value => updateEntry({ [EntryFields.semantic_domains]: new_value })}
      on_update_write_in={new_value => updateEntry({ sd: new_value })} />
    <div class="border-b-2 pb-1 mb-2 border-dashed" />
  </div>
{/if}

<EntryField
  value={sense.noun_class}
  field="noun_class"
  {can_edit}
  display={$page.data.t('entry_field.noun_class')}
  on_update={new_value => updateEntry({ [EntryFields.noun_class]: new_value })} />

{#each sense.example_sentences || [{}] as sentence}
  <div class:order-2={!sentence.vn} class="flex flex-col">
    <EntryField
      value={sentence.vn}
      field="example_sentence"
      {can_edit}
      display={$page.data.t('entry_field.example_sentence')}
      on_update={new_value => updateEntry({ 'xs.vn': new_value })} />

    {#if sentence.vn}
      {#each glossingLanguages as bcp}
        <EntryField
          class="ms-3"
          value={sentence[bcp]}
          field="example_sentence"
          {bcp}
          {can_edit}
          display={`${$page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}: ${$page.data.t('entry_field.example_sentence')}`}
          on_update={new_value => updateEntry({ [`xs.${bcp}`]: new_value })} />
      {/each}
    {/if}
  </div>
{/each}
