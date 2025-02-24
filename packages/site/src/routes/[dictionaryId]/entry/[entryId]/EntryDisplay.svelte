<script lang="ts">
  import type { EntryFieldValue, EntryView, Tables, TablesUpdate } from '@living-dictionaries/types'
  import { Button } from 'svelte-pieces'
  import EntryField from './EntryField.svelte'
  import EntryMedia from './EntryMedia.svelte'
  import Sense from './SupaSense.svelte'
  import { page } from '$app/stores'
  import EntryDialect from '$lib/components/entry/EntryDialect.svelte'
  import EntrySource from '$lib/components/entry/EntrySource.svelte'
  import type { DbOperations } from '$lib/dbOperations'
  import EntryTag from '$lib/components/entry/EntryTag.svelte'

  export let entry: EntryView
  export let dictionary: Tables<'dictionaries'>
  export let can_edit = false
  export let dbOperations: DbOperations
  export let entry_history: Tables<'content_updates'>[]

  const text_fields = ['morphology', 'interlinearization'] satisfies EntryFieldValue[]

  function update_entry(entry: TablesUpdate<'entries'>) {
    dbOperations.update_entry({ entry })
  }
</script>

<div class="flex flex-col md:grid mb-3 media-on-right-grid grid-gap-2">
  <div dir="ltr" style="grid-area: title;">
    <EntryField
      value={entry.main.lexeme.default}
      field="lexeme"
      {can_edit}
      display={$page.data.t('entry_field.lexeme')}
      on_update={(new_value) => {
        if (new_value) {
          entry.main.lexeme.default = new_value
          update_entry({ lexeme: entry.main.lexeme })
        }
      }} />
  </div>

  <div style="grid-area: media;">
    <EntryMedia {dictionary} {entry} {can_edit} {dbOperations} />
    {#if entry_history?.length}
      {#await import('./EntryHistory.svelte') then { default: EntryHistory }}
        <EntryHistory {entry_history} {can_edit} class="mt-5 hidden md:block" />
      {/await}
    {/if}
  </div>

  <div class="flex flex-col grow" style="grid-area: content;">
    {#each dictionary.orthographies || [] as orthography, index}
      {@const orthography_field = `lo${index + 1}`}
      <EntryField
        value={entry.main.lexeme[orthography_field]}
        field="local_orthography"
        {can_edit}
        display={orthography.name.default}
        on_update={(new_value) => {
          entry.main.lexeme[orthography_field] = new_value
          update_entry({ lexeme: entry.main.lexeme })
        }} />
    {/each}

    <EntryField
      value={entry.main.phonetic}
      field="phonetic"
      {can_edit}
      display={$page.data.t('entry_field.phonetic')}
      on_update={(new_value) => {
        entry.main.phonetic = new_value
        update_entry({ phonetic: new_value })
      }} />

    {#each entry.senses || [] as sense, index}
      {#if entry.senses.length === 1}
        <Sense {sense} glossLanguages={dictionary.gloss_languages} {can_edit} />

        {#if can_edit}
          <Button class="text-start p-2! mb-2 rounded order-2 hover:bg-gray-100! text-gray-600 text-start!" form="menu" onclick={async () => await dbOperations.insert_sense({ sense: {}, entry_id: entry.id })}><span class="i-system-uicons-versions text-xl" /> {$page.data.t('sense.add')}</Button>
        {/if}
      {:else}
        <div class="p-2 hover:bg-gray-50 rounded">
          <div class="font-semibold mb-2 flex">
            <div class="font-semibold">
              {$page.data.t('sense.sense')} {index + 1}
            </div>
            <div class="mx-auto" />
            {#if can_edit}
              <Button class="text-gray-500!" size="sm" form="menu" onclick={async () => await dbOperations.update_sense({ sense: { deleted: 'true' }, sense_id: sense.id })}><span class="i-fa-solid-times -mt-1" /></Button>
              <Button class="text-gray-500!" size="sm" form="menu" onclick={async () => await dbOperations.insert_sense({ sense: {}, entry_id: entry.id })}><span class="i-fa-solid-plus -mt-1" /></Button>
            {/if}
          </div>

          <div class="flex flex-col border-s-2 ps-3 ms-1">
            <Sense {sense} glossLanguages={dictionary.gloss_languages} {can_edit} />
          </div>
        </div>
      {/if}
    {/each}

    {#if entry.dialect_ids?.length || can_edit}
      <div class="md:px-2" class:order-2={!entry.dialect_ids?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.dialects')}</div>
        <EntryDialect entry_id={entry.id} {can_edit} dialect_ids={entry.dialect_ids || []} />
        <div class="border-b-2 pb-1 mb-2 border-dashed" />
      </div>
    {/if}

    {#if entry.tag_ids?.length || can_edit}
      <div class="md:px-2" class:order-2={!entry.tag_ids?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.custom_tags')}</div>
        <EntryTag entry_id={entry.id} {can_edit} tag_ids={entry.tag_ids || []} />
        <div class="border-b-2 pb-1 mb-2 border-dashed" />
      </div>
    {/if}

    <EntryField
      value={entry.main.scientific_names?.[0]}
      field="scientific_names"
      {can_edit}
      display={$page.data.t('entry_field.scientific_names')}
      on_update={(new_value) => {
        entry.main.scientific_names = [new_value]
        update_entry({ scientific_names: entry.main.scientific_names })
      }} />

    {#each text_fields as field}
      <EntryField
        value={entry.main[field]}
        {field}
        {can_edit}
        display={$page.data.t(`entry_field.${field}`)}
        on_update={(new_value) => {
          entry.main[field] = new_value
          update_entry({ [field]: new_value })
        }} />
    {/each}

    <EntryField
      value={entry.main.notes?.default}
      field="notes"
      {can_edit}
      display={$page.data.t('entry_field.notes')}
      on_update={(new_value) => {
        entry.main.notes = { default: new_value }
        update_entry({ notes: entry.main.notes })
      }} />

    {#if entry.main.sources?.length || can_edit}
      <div class="md:px-2" class:order-2={!entry.main.sources?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$page.data.t('entry_field.sources')}</div>
        <EntrySource
          {can_edit}
          value={entry.main.sources}
          on_update={(new_value) => {
            entry.main.sources = new_value
            update_entry({ sources: new_value })
          }} />
        <div class="border-b-2 pb-1 mb-2 border-dashed" />
      </div>
    {/if}

    {#if entry.main.elicitation_id || can_edit}
      <EntryField
        value={entry.main.elicitation_id}
        field="ID"
        {can_edit}
        display="ID"
        on_update={(new_value) => {
          entry.main.elicitation_id = new_value
          update_entry({ elicitation_id: new_value })
        }} />
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
