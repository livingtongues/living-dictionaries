<script lang="ts">
  import type { EntryData, Tables, TablesUpdate } from '@living-dictionaries/types'
  import EntryField from './EntryField.svelte'
  import EntrySentence from './EntrySentence.svelte'
  import { page } from '$app/state'
  import { order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses'
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte'
  import EntrySemanticDomains from '$lib/components/entry/EntrySemanticDomains.svelte'
  import { DICTIONARIES_WITH_VARIANTS } from '$lib/constants'

  interface Props {
    sense: EntryData['senses'][0];
    glossLanguages: Tables<'dictionaries'>['gloss_languages'];
    can_edit?: boolean;
  }

  let { sense, glossLanguages, can_edit = false }: Props = $props();

  let { dictionary, dbOperations } = $derived(page.data)

  function update_sense(update: TablesUpdate<'senses'>) {
    dbOperations.update_sense({ ...update, id: sense.id })
  }

  let glossingLanguages = $derived(order_entry_and_dictionary_gloss_languages(sense.glosses, glossLanguages))
  let hasSemanticDomain = $derived(sense.semantic_domains?.length || sense.write_in_semantic_domains?.length)
</script>

{#each glossingLanguages as bcp}
  <EntryField
    value={sense.glosses?.[bcp]}
    field="gloss"
    {bcp}
    {can_edit}
    display={`${page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}: ${page.data.t('entry_field.gloss')}`}
    on_update={(new_value) => {
      update_sense({ glosses: { ...sense.glosses, [bcp]: new_value } })
    }} />
{/each}

<!-- Only in Bahasa Lani (id: jaRhn6MAZim4Blvr1iEv) -->
{#if sense.definition}
  <EntryField
    value={sense.definition?.en}
    field="definition_english"
    display="Definition (deprecated)"
    {can_edit}
    on_update={(new_value) => {
      update_sense({
        definition: new_value ? { en: new_value } : null,
      })
    }} />
{/if}

{#if sense.parts_of_speech?.length || can_edit}
  <div class="md:px-2" class:order-2={!sense.parts_of_speech?.length}>
    <div class="rounded text-xs text-gray-500 mt-1 mb-2">{page.data.t('entry_field.parts_of_speech')}</div>
    <EntryPartOfSpeech
      value={sense.parts_of_speech}
      {can_edit}
      on_update={(new_value) => {
        update_sense({ parts_of_speech: new_value })
      }} />
    <div class="border-b-2 pb-1 mb-2 border-dashed"></div>
  </div>
{/if}

{#if hasSemanticDomain || can_edit}
  <div class="md:px-2" class:order-2={!hasSemanticDomain}>
    <div class="rounded text-xs text-gray-500 mt-1 mb-2">{page.data.t('entry_field.semantic_domains')}</div>
    <EntrySemanticDomains
      {can_edit}
      semantic_domain_keys={sense.semantic_domains}
      write_in_semantic_domains={sense.write_in_semantic_domains}
      on_update={(new_value) => {
        update_sense({ semantic_domains: new_value })
      }}
      on_update_write_in={(new_value) => {
        update_sense({ write_in_semantic_domains: new_value })
      }} />
    <div class="border-b-2 pb-1 mb-2 border-dashed"></div>
  </div>
{/if}

<EntryField
  value={sense.noun_class}
  field="noun_class"
  {can_edit}
  display={page.data.t('entry_field.noun_class')}
  on_update={(new_value) => {
    update_sense({ noun_class: new_value })
  }} />

{#if sense.sentences?.length}
  {#each sense.sentences as sentence}
    <EntrySentence {sentence} {can_edit} sense_id={sense.id} glossingLanguages={glossingLanguages} />
  {/each}
{:else}
  <EntrySentence sentence={{ text: {}, id: null, translation: null }} {can_edit} sense_id={sense.id} glossingLanguages={glossingLanguages} />
{/if}

<EntryField
  value={sense.plural_form?.default}
  field="plural_form"
  {can_edit}
  display={page.data.t('entry_field.plural_form')}
  on_update={(new_value) => {
    update_sense({ plural_form: { default: new_value } })
  }} />

{#if DICTIONARIES_WITH_VARIANTS.includes(dictionary.id)}
  <EntryField
    value={sense.variant?.default}
    field="variant"
    {can_edit}
    display={page.data.t('entry_field.variant')}
    on_update={new_value => update_sense({ variant: { ...sense.variant, default: new_value } })} />
{/if}
