<script lang="ts">
  import type {
    EntryData,
    IColumn,
    TablesUpdate,
  } from '$lib/types'
  import Audio from '../components/Audio.svelte'
  import EntryAudioControl from '$lib/entry/entry-audio/EntryAudioControl.svelte'
  import { from_entry_audios } from '$lib/entry/entry-audio/audio-option-labels'
  import Textbox from './cells/Textbox.svelte'
  import { SENSE_FIELDS } from './sense-fields'
  import SelectSpeakerCell from './cells/SelectSpeakerCell.svelte'
  import VideoCell from './cells/VideoCell.svelte'
  import CoordinatesCell from './cells/CoordinatesCell.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { get_headword } from '$lib/orthography/orthographies'
  import { page } from '$app/state'
  import EntrySemanticDomains from '$lib/components/entry/EntrySemanticDomains.svelte'
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte'
  import EntryDialect from '$lib/components/entry/EntryDialect.svelte'
  import EntrySource from '$lib/components/entry/EntrySource.svelte'
  import Image from '$lib/components/image/Image.svelte'
  import type { GuardedWrites } from '$lib/db/dict-client/guarded-writes'
  import EntryTag from '$lib/components/entry/EntryTag.svelte'
  import ReviewIndicator from '$lib/components/entry/ReviewIndicator.svelte'
  import IconIcOutlineCloudUpload from '~icons/ic/outline-cloud-upload'
  import IconIcOutlineCameraAlt from '~icons/ic/outline-camera-alt'
  import IconMdiPencil from '~icons/mdi/pencil'

  interface Props {
    column: IColumn
    entry: EntryData
    /** The sense this row renders (null for a sense-less entry's single row). Entry-level
     *  cells span all sense rows and receive the first sense. */
    sense: EntryData['senses'][0] | null
    /** The next row in this column's scope (next sense row for sense-level columns, next
     *  entry otherwise) — powers the edit modal's "Save ↓" column run. */
    next_row?: { entry: EntryData, sense: EntryData['senses'][0] | null } | null
    can_edit?: boolean
    writes: GuardedWrites
  }

  const {
    column,
    entry = $bindable(),
    sense,
    next_row = null,
    can_edit = false,
    writes,
  }: Props = $props()

  function run_id({ entry_id, sense_id }: { entry_id: string, sense_id: string | null }) {
    const row_id = SENSE_FIELDS.has(column.field) ? (sense_id || entry_id) : entry_id
    return `${column.field}|${column.bcp || ''}|${column.orthography_code || ''}|${row_id}`
  }
  const run_cell_id = $derived(run_id({ entry_id: entry.id, sense_id: sense?.id || null }))
  const next_run_cell_id = $derived(next_row ? run_id({ entry_id: next_row.entry.id, sense_id: next_row.sense?.id || null }) : undefined)

  const first_photo = $derived(sense?.photos?.[0])
  // Display-only headword fallback (photo title); the editable lexeme cell below stays on raw `default`.
  const headword = $derived(get_headword({ lexeme: entry.main.lexeme, orthographies: page.data.dictionary?.orthographies }))

  // Table cells DISPLAY from the read-model (and optimistically mutate it for
  // instant feedback), but persist scalar edits straight to the live `dict_db`
  // row via `update({ id })` — a partial update by id, so no per-cell reactive
  // row subscription. The audit columns + dirty are auto-stamped; the Orama
  // watcher reflects the write back into the read-model. (Sentences/photos stay
  // on `writes` — multi-table.)
  const dict_db = $derived(page.data.dict_db)
  function update_entry(update: TablesUpdate<'entries'>) {
    dict_db?.entries.update({ ...update, id: entry.id })
  }
  function update_sense(update: TablesUpdate<'senses'>) {
    if (!sense?.id) return
    dict_db?.senses.update({ ...update, id: sense.id })
  }

  // MultiString edits from the table only touch the `default` locale — merge into the
  // existing map (preserving other locales) and allow clearing (empty → key removed).
  function merged_default(existing: Record<string, string> | null | undefined, new_value: string) {
    const merged = { ...existing }
    if (new_value) merged.default = new_value
    else delete merged.default
    return Object.keys(merged).length ? merged : null
  }
</script>

<div
  class:sompeng={column.display === 'Sompeng'}
  class="cell">
  {#if column.field === 'audio'}
    {#if entry.audios?.length}
      <!-- Listen (speaker chooser when multiple) for everyone; editors get the pencil. -->
      <div class="table-audio-wrap">
        <EntryAudioControl audios={from_entry_audios(entry.audios)} entry_id={entry.id} surface="table" entry_name={headword.value} />
        {#if can_edit}
          <ShowHide>
            {#snippet children({ show, toggle })}
              <button
                type="button"
                class="edit-audio-button"
                title={page.data.t('audio.edit_audio')}
                aria-label={page.data.t('audio.edit_audio')}
                onclick={toggle}>
                <IconMdiPencil style="font-size: 0.875rem" />
              </button>
              {#if show}
                {#await import('$lib/components/audio/EditAudio.svelte') then { default: EditAudio }}
                  <EditAudio {entry} sound_file={entry.audios[0]} context="table" on_close={toggle} />
                {/await}
              {/if}
            {/snippet}
          </ShowHide>
        {/if}
      </div>
    {:else}
      <Audio class="table-audio-cell empty-affordance" context="table" {can_edit} sound_file={null} {entry} />
    {/if}
  {:else if column.field === 'photo'}
    {#if first_photo}
      <Image
        square={112}
        title={headword.value}
        photo={first_photo}
        photos={sense.photos}
        photo_source={first_photo.source}
        photographer={first_photo.photographer}
        {can_edit}
        on_delete_image={async photo_id => await writes.delete_photo(photo_id ?? first_photo.id)} />
    {:else if can_edit && sense?.id}
      <ShowHide>
        {#snippet children({ show, toggle })}
          <div class="photo-upload empty-affordance" onclick={toggle}>
            <span class="desktop-only">
              <IconIcOutlineCloudUpload style="font-size: 1.5rem" />
            </span>
            <span class="mobile-only">
              <IconIcOutlineCameraAlt style="font-size: 1.25rem" />
            </span>
          </div>

          {#if show}
            {#await import('$lib/components/image/EditImage.svelte') then { default: EditImage }}
              <EditImage on_close={toggle} sense_id={sense.id} />
            {/await}
          {/if}
        {/snippet}
      </ShowHide>
    {/if}
  {:else if column.field === 'video'}
    <VideoCell {entry} {sense} {can_edit} title={headword.value} />
  {:else if column.field === 'coordinates'}
    <CoordinatesCell {entry} {can_edit} />
  {:else if column.field === 'speaker'}
    <SelectSpeakerCell {can_edit} {entry} />
  {:else if column.field === 'parts_of_speech'}
    <EntryPartOfSpeech
      {can_edit}
      value={sense?.parts_of_speech}
      showPlus={false}
      on_update={(new_value) => {
        if (writes.check_ready() || !sense) return
        sense.parts_of_speech = new_value
        update_sense({ parts_of_speech: new_value })
      }} />
  {:else if column.field === 'semantic_domains'}
    <EntrySemanticDomains
      {can_edit}
      show_plus={false}
      semantic_domain_keys={sense?.semantic_domains}
      write_in_semantic_domains={sense?.write_in_semantic_domains}
      on_update={(new_value) => {
        if (writes.check_ready() || !sense) return
        sense.semantic_domains = new_value
        update_sense({ semantic_domains: new_value })
      }}
      on_update_write_in={(new_value) => {
        if (writes.check_ready() || !sense) return
        sense.write_in_semantic_domains = new_value
        update_sense({ write_in_semantic_domains: new_value })
      }} />
  {:else if column.field === 'dialects'}
    <EntryDialect
      entry_id={entry.id}
      {can_edit}
      showPlus={false}
      dialects={entry.dialects || []} />
  {:else if column.field === 'custom_tags'}
    <EntryTag
      entry_id={entry.id}
      {can_edit}
      showPlus={false}
      tags={entry.tags || []} />
  {:else if column.field === 'sources'}
    <EntrySource
      {can_edit}
      value={entry.main.sources}
      citations={entry.main.citations}
      on_update={(new_value) => {
        if (writes.check_ready()) return
        entry.main.sources = new_value
        update_entry({ sources: new_value })
      }} />
  {:else if column.field === 'sense_sources'}
    {#if sense}
      <EntrySource
        {can_edit}
        value={sense.sources}
        on_update={(new_value) => {
          if (writes.check_ready() || !sense) return
          sense.sources = new_value
          update_sense({ sources: new_value })
        }} />
    {/if}
  {:else if column.field === 'gloss'}
    <Textbox
      {run_cell_id}
      {next_run_cell_id}
      field={column.field}
      value={sense?.glosses?.[column.bcp]}
      display={column.display}
      on_update={(new_value) => {
        if (writes.check_ready() || !sense) return
        sense.glosses = { ...sense.glosses, [column.bcp]: new_value }
        update_sense({ glosses: sense?.glosses })
      }} />
  {:else if column.field === 'definition'}
    <Textbox
      {run_cell_id}
      {next_run_cell_id}
      field={column.field}
      value={sense?.definition?.[column.bcp]}
      display={column.display}
      on_update={(new_value) => {
        if (writes.check_ready() || !sense) return
        sense.definition = { ...sense.definition, [column.bcp]: new_value }
        update_sense({ definition: sense.definition })
      }} />
  {:else if column.field === 'example_sentence'}
    {@const sentence = sense?.sentences?.[0]}
    {#if column.bcp === 'vn'}
      <Textbox
        {run_cell_id}
        {next_run_cell_id}
        field={column.field}
        value={sentence?.text?.default}
        display={page.data.t('entry_field.example_sentence')}
        on_update={async (new_value) => {
          if (!sentence?.id) {
            await writes.insert_sentence({
              sentence: { text: { default: new_value } },
              sense_id: sense?.id,
            })
          } else {
            await writes.update_sentence({
              text: { default: new_value },
              id: sentence.id,
            })
          }
        }} />
    {:else}
      {#if sentence}
        <Textbox
          {run_cell_id}
          {next_run_cell_id}
          field={column.field}
          value={sentence?.translation?.[column.bcp]}
          display="{page.data.t({ dynamicKey: `gl.${column.bcp}`, fallback: column.bcp })}: {page.data.t('entry_field.example_sentence')}"
          on_update={async (new_value) => {
            await writes.update_sentence({
              translation: {
                ...sentence?.translation,
                [column.bcp]: new_value,
              },
              id: sentence.id,
            })
          }} />
      {:else}
        <div class="needs-sentence-first" title={page.data.t('entry.add_example_sentence_first')}></div>
      {/if}
    {/if}
  {:else if column.field === 'scientific_names'}
    <Textbox
      {run_cell_id}
      {next_run_cell_id}
      inline
      field={column.field}
      value={entry.main.scientific_names?.[0]}
      display={page.data.t('entry_field.scientific_names')}
      on_update={(new_value) => {
        if (writes.check_ready()) return
        const additional_names = entry.main.scientific_names?.slice(1) || []
        const names = new_value ? [new_value, ...additional_names] : additional_names
        entry.main.scientific_names = names.length ? names : null
        update_entry({ scientific_names: entry.main.scientific_names })
      }} />
  {:else if column.field === 'local_orthography'}
    {@const orthography_field = column.orthography_code}
    <Textbox
      {run_cell_id}
      {next_run_cell_id}
      field={column.field}
      value={entry.main.lexeme[orthography_field]}
      display={column.display}
      on_update={(new_value) => {
        if (writes.check_ready()) return
        entry.main.lexeme[orthography_field] = new_value
        update_entry({ lexeme: entry.main.lexeme })
      }} />
  {:else if column.field === 'lexeme'}
    {#if entry.main.review}<span class="table-review"><ReviewIndicator review={entry.main.review} /></span>{/if}
    <Textbox
      {run_cell_id}
      {next_run_cell_id}
      field={column.field}
      value={entry.main.lexeme.default}
      display={page.data.t('entry_field.lexeme')}
      on_update={(new_value) => {
        if (writes.check_ready()) return
        if (new_value) {
          entry.main.lexeme.default = new_value
          update_entry({ lexeme: entry.main.lexeme })
        }
      }} />
  {:else if column.field === 'notes'}
    <Textbox
      {run_cell_id}
      {next_run_cell_id}
      field={column.field}
      value={entry.main.notes?.default}
      display={page.data.t('entry_field.notes')}
      on_update={(new_value) => {
        if (writes.check_ready()) return
        entry.main.notes = merged_default(entry.main.notes, new_value)
        update_entry({ notes: entry.main.notes })
      }} />
  {:else if column.field === 'linguistic_history'}
    <Textbox
      {run_cell_id}
      {next_run_cell_id}
      field={column.field}
      value={entry.main.linguistic_history?.default}
      display={page.data.t('entry_field.linguistic_history')}
      on_update={(new_value) => {
        if (writes.check_ready()) return
        entry.main.linguistic_history = merged_default(entry.main.linguistic_history, new_value)
        update_entry({ linguistic_history: entry.main.linguistic_history })
      }} />
  {:else if column.field === 'interlinearization' || column.field === 'morphology' || column.field === 'phonetic' || column.field === 'elicitation_id'}
    <Textbox
      {run_cell_id}
      {next_run_cell_id}
      inline={column.field !== 'phonetic'}
      field={column.field}
      value={entry.main[column.field]}
      display={page.data.t(`entry_field.${column.field}`)}
      gloss_codes={column.field === 'morphology' || column.field === 'interlinearization'}
      on_update={(new_value) => {
        if (writes.check_ready()) return
        entry.main[column.field] = new_value
        update_entry({ [column.field]: new_value })
      }} />
  {:else if column.field === 'noun_class'}
    <Textbox
      {run_cell_id}
      {next_run_cell_id}
      inline
      field={column.field}
      value={sense?.noun_class}
      display={page.data.t(`entry_field.${column.field}`)}
      on_update={(new_value) => {
        if (writes.check_ready() || !sense) return
        sense.noun_class = new_value
        update_sense({ noun_class: new_value })
      }} />
  {:else if column.field === 'plural_form'}
    <Textbox
      {run_cell_id}
      {next_run_cell_id}
      field={column.field}
      value={sense?.plural_form?.default}
      display={page.data.t(`entry_field.${column.field}`)}
      on_update={(new_value) => {
        if (writes.check_ready() || !sense) return
        sense.plural_form = merged_default(sense.plural_form, new_value)
        update_sense({ plural_form: sense.plural_form })
      }} />
  {:else if column.field === 'variant'}
    <Textbox
      {run_cell_id}
      {next_run_cell_id}
      inline
      field={column.field}
      value={sense?.variant?.default}
      display={page.data.t('entry_field.variant')}
      on_update={(new_value) => {
        if (writes.check_ready() || !sense) return
        sense.variant = merged_default(sense.variant, new_value)
        update_sense({ variant: sense.variant })
      }} />
  {:else if column.field === 'homograph'}
    <Textbox
      {run_cell_id}
      {next_run_cell_id}
      inline
      field={column.field}
      value={entry.main.homograph}
      display={page.data.t('entry_field.homograph')}
      on_update={(new_value) => {
        if (writes.check_ready()) return
        entry.main.homograph = new_value || null
        update_entry({ homograph: entry.main.homograph })
      }} />
  {/if}
</div>

<style>
  /* Firefox */
  /* .hide-scrollbar {
    scrollbar-width: none;
  } */
  /* Safari and Chrome */
  /* .hide-scrollbar::-webkit-scrollbar {
    display: none;
  } */

  .cell {
    height: 100%;
    width: 100%;
    display: flex;
  }

  .table-review {
    align-self: center;
    display: inline-flex;
    padding-inline-start: 0.375rem;
    font-size: 1rem;
  }

  .cell :global(.table-audio-cell) {
    height: 100%;
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  .table-audio-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    width: 100%;
    height: 100%;
  }

  .edit-audio-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
    transition: background var(--transition-time, 150ms);
  }

  .edit-audio-button:hover {
    background: color-mix(in srgb, var(--color) 10%, transparent);
  }

  .needs-sentence-first {
    height: 100%;
    background: repeating-linear-gradient(-45deg, transparent, transparent 6px, color-mix(in srgb, var(--color) 4%, transparent) 6px, color-mix(in srgb, var(--color) 4%, transparent) 12px);
  }

  .photo-upload {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    cursor: pointer;
  }

  .desktop-only {
    display: none;
  }

  @media (min-width: 768px) {
    .desktop-only {
      display: inline;
    }

    .mobile-only {
      display: none;
    }
  }

  :global(.cell > *) {
    flex: 1;
  }

  div :global(button) {
    margin-bottom: 0px !important;
  }
</style>
