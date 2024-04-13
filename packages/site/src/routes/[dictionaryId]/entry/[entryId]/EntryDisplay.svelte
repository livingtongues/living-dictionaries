<script lang="ts">
  import { type ActualDatabaseEntry, type EntryFieldValue, EntryFields, type ExpandedEntry, type GoalDatabaseEntry, type IDictionary } from '@living-dictionaries/types'
  import { Button } from 'svelte-pieces'
  import EntryField from './EntryField.svelte'
  import EntryMedia from './EntryMedia.svelte'
  import Sense from './Sense.svelte'
  import SupaSense from './SupaSense.svelte'
  import { page } from '$app/stores'
  import EntryDialect from '$lib/components/entry/EntryDialect.svelte'
  import { DICTIONARIES_WITH_VARIANTS } from '$lib/constants'
  import EntrySource from '$lib/components/entry/EntrySource.svelte'
  import type { DbOperations } from '$lib/dbOperations'
  import type { SupaEntry } from '$lib/supabase/database.types'

  export let entry: ExpandedEntry
  export let supaEntry: SupaEntry
  export let dictionary: IDictionary
  export let can_edit = false
  export let videoAccess = false
  export let dbOperations: DbOperations

  const regularFields = ['plural_form', 'morphology', 'interlinearization', 'notes'] satisfies EntryFieldValue[]

  async function addSense() {
    await dbOperations.update_sense({ entry_id: entry.id, change: { glosses: { new: null } }, sense_id: window.crypto.randomUUID() })
  }
  async function deleteSense(sense_id: string) {
    await dbOperations.update_sense({ entry_id: entry.id, change: { deleted: true }, sense_id })
  }

  function updateEntry(data: ActualDatabaseEntry) {
    dbOperations.updateEntry({ data: data as GoalDatabaseEntry, entryId: entry.id })
  }
</script>

<div class="flex flex-col md:grid mb-3 media-on-right-grid grid-gap-2">
  <div dir="ltr" style="grid-area: title;">
    <EntryField
      value={entry.lexeme}
      field="lexeme"
      {can_edit}
      display={$page.data.t('entry_field.lexeme')}
      on_update={new_value => updateEntry({ [EntryFields.lexeme]: new_value })} />
  </div>

  <div style="grid-area: media;">
    <EntryMedia {dictionary} {entry} {can_edit} {videoAccess} {dbOperations} />
  </div>

  <div class="flex flex-col grow" style="grid-area: content;">
    {#each dictionary.alternateOrthographies || [] as orthography, index}
      {@const orthographyIndex = index + 1}
      <EntryField
        value={entry[`local_orthography_${orthographyIndex}`]}
        field="local_orthography"
        {can_edit}
        display={orthography}
        on_update={new_value => updateEntry({ [`lo${orthographyIndex}`]: new_value })} />
    {/each}

    <EntryField value={entry.phonetic} field="phonetic" {can_edit} display={$page.data.t('entry_field.phonetic')} on_update={new_value => updateEntry({ [EntryFields.phonetic]: new_value })} />

    {#if !supaEntry?.senses?.length}
      <Sense sense={entry.senses[0]} {can_edit} glossLanguages={dictionary.glossLanguages} {updateEntry} />

      {#if can_edit}
        <Button class="text-start p-2! mb-2 rounded order-2 hover:bg-gray-100! text-gray-600" form="menu" onclick={addSense}><span class="i-system-uicons-versions text-xl" /> Add Sense</Button>
      {/if}
    {:else}
      <div class="p-2 hover:bg-gray-50 rounded">
        <div class="font-semibold mb-2 flex">
          <div class="font-semibold">
            Sense 1
          </div>
        </div>
        <div class="flex flex-col border-s-2 ps-3 ms-1">
          <Sense sense={entry.senses[0]} {can_edit} glossLanguages={dictionary.glossLanguages} {updateEntry} />
        </div>
      </div>

      {#each supaEntry.senses as sense, index}
        <div class="p-2 hover:bg-gray-50 rounded">
          <div class="font-semibold mb-2 flex">
            <div class="font-semibold">
              Sense {index + 2}
            </div>
            <div class="mx-auto" />
            {#if can_edit}
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

          <div class="flex flex-col border-s-2 ps-3 ms-1">
            <SupaSense entryId={entry.id} {...dbOperations} {sense} glossLanguages={dictionary.glossLanguages} {can_edit} />
          </div>
        </div>
      {/each}
    {/if}

    {#if entry.dialects?.length || can_edit}
      <div class="md:px-2" class:order-2={!entry.dialects?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.dialects')}</div>
        <EntryDialect {can_edit} dialects={entry.dialects} dictionaryId={dictionary.id} on_update={new_value => updateEntry({ [EntryFields.dialects]: new_value })} />
        <div class="border-b-2 pb-1 mb-2 border-dashed" />
      </div>
    {/if}

    <!-- TODO: make multiple with generic component -->
    <EntryField
      value={entry.scientific_names?.[0]}
      field="scientific_names"
      {can_edit}
      display={$page.data.t('entry_field.scientific_names')}
      on_update={new_value => updateEntry({ [EntryFields.scientific_names]: [new_value] })} />

    {#if DICTIONARIES_WITH_VARIANTS.includes(dictionary.id)}
      <EntryField
        value={entry.variant}
        field="variant"
        {can_edit}
        display={$page.data.t('entry_field.variant')}
        on_update={new_value => updateEntry({ [EntryFields.variant]: new_value })} />
    {/if}

    {#each regularFields as field}
      <EntryField
        value={entry[field]}
        {field}
        {can_edit}
        display={$page.data.t(`entry_field.${field}`)}
        on_update={new_value => updateEntry({ [EntryFields[field]]: new_value })} />
    {/each}

    {#if entry.sources?.length || can_edit}
      <div class="md:px-2" class:order-2={!entry.sources?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.sources')}</div>
        <EntrySource
          {can_edit}
          value={entry.sources}
          on_update={new_value => updateEntry({ [EntryFields.sources]: new_value })} />
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
