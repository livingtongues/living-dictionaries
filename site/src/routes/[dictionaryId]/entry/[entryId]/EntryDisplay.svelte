<script lang="ts">
  import type { EntryData, Tables } from '$lib/types'
  import EntryField from './EntryField.svelte'
  import EntryMedia from './EntryMedia.svelte'
  import Sense from './Sense.svelte'
  import { Button } from '$lib/svelte-pieces'
  import { page } from '$app/stores'
  import EntryDialect from '$lib/components/entry/EntryDialect.svelte'
  import EntrySource from '$lib/components/entry/EntrySource.svelte'
  import type { DbOperations } from '$lib/dbOperations'
  import EntryTag from '$lib/components/entry/EntryTag.svelte'
  import IconSystemUiconsVersions from '~icons/system-uicons/versions'
  import IconFaSolidTimes from '~icons/fa-solid/times'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  interface Props {
    entry: EntryData
    dictionary: Tables<'dictionaries'>
    can_edit?: boolean
    dbOperations: DbOperations
  }

  const {
    entry,
    dictionary,
    can_edit = false,
    dbOperations,
  }: Props = $props()

  // Scalar entry fields render + save directly off the live `dict_db` row
  // (mutate, then `_save()` — auto-stamps the editing user + dirty). The Orama
  // watcher reflects each save back into the `EntryData` read-model that the
  // list/gallery/table/SEO surfaces use. Multi-table concerns (senses, media,
  // dialects, tags) stay on `dbOperations`/the read-model for now. See
  // `.issues/livedb-scalar-field-migration.md`.
  const dict_db = $derived($page.data.dict_db)
  const entry_row = $derived(dict_db?.entries.id(entry.id))
  // Display values prefer the live row, but fall back to the read-model
  // (`entry.main`) so the entry renders server-side / during the cold window
  // before the live dict.db opens. `entry.main` shares the entries row's scalar
  // field names, so the swap to `entry_row` once it arrives is seamless.
  const fields = $derived(entry_row ?? entry.main)

  async function save_entry(patch: Partial<NonNullable<typeof entry_row>>) {
    if (!entry_row) return
    Object.assign(entry_row, patch)
    await entry_row._save()
  }
</script>

<div class="media-on-right-grid">
  <div dir="ltr" style="grid-area: title;">
    <EntryField
      value={fields?.lexeme?.default}
      field="lexeme"
      {can_edit}
      display={$page.data.t('entry_field.lexeme')}
      on_update={(new_value) => {
        if (new_value)
          save_entry({ lexeme: { ...entry_row?.lexeme, default: new_value } })
      }} />
  </div>

  <div style="grid-area: media;">
    <EntryMedia {dictionary} {entry} {can_edit} {dbOperations} />
  </div>

  <div class="content-col" style="grid-area: content;">
    {#each dictionary.orthographies || [] as orthography, index (index)}
      {@const orthography_field = `lo${index + 1}`}
      <EntryField
        value={fields?.lexeme?.[orthography_field]}
        field="local_orthography"
        {can_edit}
        display={orthography.name}
        on_update={(new_value) => {
          save_entry({ lexeme: { ...entry_row?.lexeme, [orthography_field]: new_value } })
        }} />
    {/each}

    <EntryField
      value={fields?.phonetic}
      field="phonetic"
      {can_edit}
      display={$page.data.t('entry_field.phonetic')}
      on_update={new_value => save_entry({ phonetic: new_value })} />

    {#each entry.senses || [] as sense, index (sense.id)}
      {#if entry.senses.length === 1}
        <Sense {sense} glossLanguages={dictionary.gloss_languages} {can_edit} />

        {#if can_edit}
          <Button class="add-sense-button" form="menu" onclick={async () => await dbOperations.insert_sense(entry.id)}><IconSystemUiconsVersions class="icon-inline" style="font-size: 1.25rem" /> {$page.data.t('sense.add')}</Button>
        {/if}
      {:else}
        <div class="sense-block">
          <div class="sense-header">
            <div>
              {$page.data.t('sense.sense')} {index + 1}
            </div>
            <div style="margin-left: auto; margin-right: auto"></div>
            {#if can_edit}
              <Button class="sense-action-button delete-sense-button" size="sm" form="menu" onclick={async () => await dbOperations.delete_sense(sense.id)}><IconFaSolidTimes class="icon-inline" style="margin-top: -0.25rem" /></Button>
              <Button class="sense-action-button insert-sense-button" size="sm" form="menu" onclick={async () => await dbOperations.insert_sense(entry.id)}><IconFaSolidPlus class="icon-inline" style="margin-top: -0.25rem" /></Button>
            {/if}
          </div>

          <div class="sense-indent">
            <Sense {sense} glossLanguages={dictionary.gloss_languages} {can_edit} />
          </div>
        </div>
      {/if}
    {/each}

    {#if entry.dialects?.length || can_edit}
      <div class="side-section" class:at-end={!entry.dialects?.length}>
        <div class="section-label">{$page.data.t('entry_field.dialects')}</div>
        <EntryDialect
          entry_id={entry.id}
          {can_edit}
          dialects={entry.dialects || []} />
        <div class="dashed-divider"></div>
      </div>
    {/if}

    {#if entry.tags?.length || can_edit}
      <div class="side-section" class:at-end={!entry.tags?.length}>
        <div class="section-label">{$page.data.t('entry_field.custom_tags')}</div>
        <EntryTag
          entry_id={entry.id}
          {can_edit}
          tags={entry.tags || []} />
        <div class="dashed-divider"></div>
      </div>
    {/if}

    <EntryField
      value={fields?.scientific_names?.[0]}
      field="scientific_names"
      {can_edit}
      display={$page.data.t('entry_field.scientific_names')}
      on_update={new_value => save_entry({ scientific_names: [new_value] })} />

    <EntryField
      value={fields?.morphology}
      field="morphology"
      {can_edit}
      display={$page.data.t('entry_field.morphology')}
      on_update={new_value => save_entry({ morphology: new_value })} />

    <EntryField
      value={fields?.interlinearization}
      field="interlinearization"
      {can_edit}
      display={$page.data.t('entry_field.interlinearization')}
      on_update={new_value => save_entry({ interlinearization: new_value })} />

    <EntryField
      value={fields?.notes?.default}
      field="notes"
      {can_edit}
      display={$page.data.t('entry_field.notes')}
      on_update={new_value => save_entry({ notes: { default: new_value } })} />

    <EntryField
      value={fields?.linguistic_history?.default}
      field="linguistic_history"
      {can_edit}
      display={$page.data.t('entry_field.linguistic_history')}
      on_update={new_value => save_entry({ linguistic_history: { default: new_value } })} />

    {#if fields?.sources?.length || can_edit}
      <div class="side-section" class:at-end={!fields?.sources?.length}>
        <div class="section-label">{$page.data.t('entry_field.sources')}</div>
        <EntrySource
          {can_edit}
          value={fields?.sources}
          on_update={new_value => save_entry({ sources: new_value })} />
        <div class="dashed-divider"></div>
      </div>
    {/if}

    {#if fields?.elicitation_id || can_edit}
      <EntryField
        value={fields?.elicitation_id}
        field="ID"
        {can_edit}
        display="ID"
        on_update={new_value => save_entry({ elicitation_id: new_value })} />
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
      display: flex;
      flex-direction: column;
      margin-bottom: 0.75rem;
      gap: 0.5rem;
    }

  @media (min-width: 768px) {
    .media-on-right-grid {
      display: grid;
    }
  }

  .content-col {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
  }

  .content-col :global(.add-sense-button) {
    text-align: start !important;
    padding: 0.5rem !important;
    margin-bottom: 0.5rem;
    border-radius: 0.25rem;
    order: 2;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
  }

  .content-col :global(.add-sense-button:hover) {
    background-color: var(--surface) !important; /* ≈ gray-100 */
  }

  .sense-block {
    padding: 0.5rem;
    border-radius: 0.25rem;
  }

  .sense-block:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 2%); /* ≈ gray-50 */
  }

  .sense-header {
    font-weight: 600;
    margin-bottom: 0.5rem;
    display: flex;
  }

  .sense-header :global(.sense-action-button) {
    color: var(--color-secondary) !important; /* ≈ gray-500 */
  }

  .sense-indent {
    display: flex;
    flex-direction: column;
    border-inline-start-width: 2px;
    padding-inline-start: 0.75rem;
    margin-inline-start: 0.25rem;
  }

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
</style>
