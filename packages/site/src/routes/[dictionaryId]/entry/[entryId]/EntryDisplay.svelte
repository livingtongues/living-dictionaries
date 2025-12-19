<script lang="ts">
  import type { EntryData, EntryFieldValue, Tables, TablesUpdate } from '@living-dictionaries/types'
  import { Button } from '$lib/svelte-pieces'
  import EntryField from './EntryField.svelte'
  import EntryMedia from './EntryMedia.svelte'
  import Sense from './Sense.svelte'
  import { page } from '$app/state'
  import EntryDialect from '$lib/components/entry/EntryDialect.svelte'
  import EntrySource from '$lib/components/entry/EntrySource.svelte'
  import type { DbOperations } from '$lib/dbOperations'
  import EntryTag from '$lib/components/entry/EntryTag.svelte'

  interface Props {
    entry: EntryData;
    dictionary: Tables<'dictionaries'>;
    can_edit?: boolean;
    dbOperations: DbOperations;
    entry_history: Tables<'content_updates'>[];
  }

  let {
    entry,
    dictionary,
    can_edit = false,
    dbOperations,
    entry_history
  }: Props = $props();

  const text_fields = ['morphology', 'interlinearization'] satisfies EntryFieldValue[]

  function update_entry(update: TablesUpdate<'entries'>) {
    dbOperations.update_entry(update)
  }
</script>

<div class="flex flex-col md:grid mb-3 media-on-right-grid grid-gap-2">
  <div dir="ltr" style="grid-area: title;">
    <EntryField
      value={entry.main.lexeme.default}
      field="lexeme"
      {can_edit}
      display={page.data.t('entry_field.lexeme')}
      on_update={(new_value) => {
        if (new_value) {
          update_entry({ lexeme: { ...entry.main.lexeme, default: new_value } })
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
          update_entry({ lexeme: { ...entry.main.lexeme, [orthography_field]: new_value } })
        }} />
    {/each}

    <EntryField
      value={entry.main.phonetic}
      field="phonetic"
      {can_edit}
      display={page.data.t('entry_field.phonetic')}
      on_update={(new_value) => {
        update_entry({ phonetic: new_value })
      }} />

    {#each entry.senses || [] as sense, index}
      {#if entry.senses.length === 1}
        <Sense {sense} glossLanguages={dictionary.gloss_languages} {can_edit} />

        {#if can_edit}
          <Button class="text-start p-2! mb-2 rounded order-2 hover:bg-gray-100! text-gray-600 text-start!" form="menu" onclick={async () => await dbOperations.insert_sense(entry.id)}><span class="i-system-uicons-versions text-xl"></span> {page.data.t('sense.add')}</Button>
        {/if}
      {:else}
        <div class="p-2 hover:bg-gray-50 rounded">
          <div class="font-semibold mb-2 flex">
            <div class="font-semibold">
              {page.data.t('sense.sense')} {index + 1}
            </div>
            <div class="mx-auto"></div>
            {#if can_edit}
              <Button class="text-gray-500!" size="sm" form="menu" onclick={async () => await dbOperations.update_sense({ deleted: new Date().toISOString(), id: sense.id })}><span class="i-fa-solid-times -mt-1"></span></Button>
              <Button class="text-gray-500!" size="sm" form="menu" onclick={async () => await dbOperations.insert_sense(entry.id)}><span class="i-fa-solid-plus -mt-1"></span></Button>
            {/if}
          </div>

          <div class="flex flex-col border-s-2 ps-3 ms-1">
            <Sense {sense} glossLanguages={dictionary.gloss_languages} {can_edit} />
          </div>
        </div>
      {/if}
    {/each}

    {#if entry.dialects?.length || can_edit}
      <div class="md:px-2" class:order-2={!entry.dialects?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{page.data.t('entry_field.dialects')}</div>
        <EntryDialect
          entry_id={entry.id}
          {can_edit}
          dialects={entry.dialects || []} />
        <div class="border-b-2 pb-1 mb-2 border-dashed"></div>
      </div>
    {/if}

    {#if entry.tags?.length || can_edit}
      <div class="md:px-2" class:order-2={!entry.tags?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{page.data.t('entry_field.custom_tags')}</div>
        <EntryTag
          entry_id={entry.id}
          {can_edit}
          tags={entry.tags || []} />
        <div class="border-b-2 pb-1 mb-2 border-dashed"></div>
      </div>
    {/if}

    <EntryField
      value={entry.main.scientific_names?.[0]}
      field="scientific_names"
      {can_edit}
      display={page.data.t('entry_field.scientific_names')}
      on_update={(new_value) => {
        update_entry({ scientific_names: [new_value] })
      }} />

    {#each text_fields as field}
      <EntryField
        value={entry.main[field]}
        {field}
        {can_edit}
        display={page.data.t(`entry_field.${field}`)}
        on_update={(new_value) => {
          update_entry({ [field]: new_value })
        }} />
    {/each}

    <EntryField
      value={entry.main.notes?.default}
      field="notes"
      {can_edit}
      display={page.data.t('entry_field.notes')}
      on_update={(new_value) => {
        update_entry({ notes: { default: new_value } })
      }} />

    {#if entry.main.sources?.length || can_edit}
      <div class="md:px-2" class:order-2={!entry.main.sources?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{page.data.t('entry_field.sources')}</div>
        <EntrySource
          {can_edit}
          value={entry.main.sources}
          on_update={(new_value) => {
            update_entry({ sources: new_value })
          }} />
        <div class="border-b-2 pb-1 mb-2 border-dashed"></div>
      </div>
    {/if}

    {#if entry.main.elicitation_id || can_edit}
      <EntryField
        value={entry.main.elicitation_id}
        field="ID"
        {can_edit}
        display="ID"
        on_update={(new_value) => {
          update_entry({ elicitation_id: new_value })
        }} />
    {/if}

    <!-- <div class="grow-1 order-last"></div> -->
  </div>
</div>

<style>
  .media-on-right-grid {
      grid-template-columns: 3fr 1fr;
      grid-template-areas:
        'title media'
        'content media'
        'here_to_push_title_and_content_up media';
    }
</style>
