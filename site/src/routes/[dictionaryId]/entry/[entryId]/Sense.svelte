<script lang="ts">
  import type { EntryData, Tables } from '$lib/types'
  import EntryField from './EntryField.svelte'
  import EntrySentence from './EntrySentence.svelte'
  import { page } from '$app/state'
  import { order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses'
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte'
  import EntrySemanticDomains from '$lib/components/entry/EntrySemanticDomains.svelte'
  import { DICTIONARIES_WITH_VARIANTS } from '$lib/constants'
  import IconSystemUiconsVersions from '~icons/system-uicons/versions'

  interface Props {
    sense: EntryData['senses'][0]
    glossLanguages: Tables<'dictionaries'>['gloss_languages']
    can_edit?: boolean
  }

  const { sense, glossLanguages, can_edit = false }: Props = $props()

  const dictionary = $derived(page.data.dictionary)
  const dbOperations = $derived(page.data.dbOperations)

  // Scalar sense fields render + save off the live `dict_db` senses row (mutate,
  // then `_save()` — auto-stamps editor + dirty); the Orama watcher reflects each
  // save back into the read-model. Sentences stay on `dbOperations` (multi-table).
  const dict_db = $derived(page.data.dict_db)
  const sense_row = $derived(dict_db?.senses.id(sense.id))
  // Display values prefer the live row, falling back to the read-model `sense`
  // so the sense renders server-side / during the cold window before the live
  // dict.db opens (they share the senses row's scalar field names → seamless swap).
  const sense_fields = $derived(sense_row ?? sense)

  async function save_sense(patch: Partial<NonNullable<typeof sense_row>>) {
    if (!sense_row) return
    Object.assign(sense_row, patch)
    await sense_row._save()
  }

  const glossingLanguages = $derived(order_entry_and_dictionary_gloss_languages(sense_fields?.glosses, glossLanguages))
  const hasSemanticDomain = $derived(sense_fields?.semantic_domains?.length || sense_fields?.write_in_semantic_domains?.length)
</script>

{#each glossingLanguages as bcp (bcp)}
  <EntryField
    value={sense_fields?.glosses?.[bcp]}
    field="gloss"
    {bcp}
    {can_edit}
    display={`${page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}: ${page.data.t('entry_field.gloss')}`}
    on_update={(new_value) => {
      save_sense({ glosses: { ...sense_row?.glosses, [bcp]: new_value } })
    }} />
{/each}

<!-- Only in Bahasa Lani (id: jaRhn6MAZim4Blvr1iEv) -->
{#if sense_fields?.definition}
  <EntryField
    value={sense_fields?.definition?.en}
    field="definition_english"
    display="Definition (deprecated)"
    {can_edit}
    on_update={(new_value) => {
      save_sense({ definition: new_value ? { en: new_value } : null })
    }} />
{/if}

{#if sense_fields?.parts_of_speech?.length || can_edit}
  <div class="side-section" class:at-end={!sense_fields?.parts_of_speech?.length}>
    <div class="section-label">{page.data.t('entry_field.parts_of_speech')}</div>
    <EntryPartOfSpeech
      value={sense_fields?.parts_of_speech}
      {can_edit}
      on_update={new_value => save_sense({ parts_of_speech: new_value })} />
    <div class="dashed-divider"></div>
  </div>
{/if}

{#if hasSemanticDomain || can_edit}
  <div class="side-section" class:at-end={!hasSemanticDomain}>
    <div class="section-label">{page.data.t('entry_field.semantic_domains')}</div>
    <EntrySemanticDomains
      {can_edit}
      semantic_domain_keys={sense_fields?.semantic_domains}
      write_in_semantic_domains={sense_fields?.write_in_semantic_domains}
      on_update={new_value => save_sense({ semantic_domains: new_value })}
      on_update_write_in={new_value => save_sense({ write_in_semantic_domains: new_value })} />
    <div class="dashed-divider"></div>
  </div>
{/if}

<EntryField
  value={sense_fields?.noun_class}
  field="noun_class"
  {can_edit}
  display={page.data.t('entry_field.noun_class')}
  on_update={new_value => save_sense({ noun_class: new_value })} />

{#if sense.sentences?.length}
  {#each sense.sentences as sentence (sentence.id)}
    <EntrySentence {sentence} {can_edit} sense_id={sense.id} glossingLanguages={glossingLanguages} />
  {/each}
{:else}
  <EntrySentence sentence={{ text: {}, id: null, translation: null }} {can_edit} sense_id={sense.id} glossingLanguages={glossingLanguages} />
{/if}

{#if can_edit && sense.sentences?.length}
  <button
    type="button"
    class="add-sentence"
    onclick={() => dbOperations.insert_sentence({ sentence: {}, sense_id: sense.id })}>
    <IconSystemUiconsVersions class="icon-inline" style="font-size: 1.25rem" /> {page.data.t('sentence.add')}
  </button>
{/if}

<EntryField
  value={sense_fields?.plural_form?.default}
  field="plural_form"
  {can_edit}
  display={page.data.t('entry_field.plural_form')}
  on_update={new_value => save_sense({ plural_form: { default: new_value } })} />

{#if DICTIONARIES_WITH_VARIANTS.includes(dictionary.id)}
  <EntryField
    value={sense_fields?.variant?.default}
    field="variant"
    {can_edit}
    display={page.data.t('entry_field.variant')}
    on_update={new_value => save_sense({ variant: { ...sense_row?.variant, default: new_value } })} />
{/if}

<style>
  @media (min-width: 768px) {
    .side-section {
      padding-left: 0.5rem;
      padding-right: 0.5rem;
    }
  }

  .at-end {
    order: 2;
  }

  .section-label {
    border-radius: 0.25rem;
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--color-secondary); /* ≈ gray-500 */
    margin-top: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .dashed-divider {
    border-bottom-width: 2px;
    padding-bottom: 0.25rem;
    margin-bottom: 0.5rem;
    border-style: dashed;
  }

  .add-sentence {
    text-align: start;
    padding: 0.5rem;
    margin-bottom: 0.5rem;
    border-radius: 0.25rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
  }

  .add-sentence:hover {
    background-color: var(--surface); /* ≈ gray-100 */
  }
</style>
