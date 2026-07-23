<script lang="ts">
  import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'
  import type { EntryData } from '$lib/types'
  import { page } from '$app/state'
  import Popover from '$lib/components/ui/Popover.svelte'
  import EntryPickerModal from './EntryPickerModal.svelte'
  import { token_kind } from './token-kind'
  import { get_headword } from '$lib/orthography/orthographies'
  import { photo_src } from '$lib/utils/media-url'
  import IconMdiArrowRight from '~icons/mdi/arrow-right'

  interface Props {
    sentence: DictRowType<'sentences'>
    orthography: string
    token_index: number
    anchor: HTMLElement
    can_edit?: boolean
    on_close: () => void
  }

  const { sentence, orthography, token_index, anchor, can_edit = false, on_close }: Props = $props()

  const { t, writes, entries_data, dictionary } = $derived(page.data)

  const token = $derived(sentence.tokens?.[orthography]?.[token_index])
  const kind = $derived(token ? token_kind(token) : null)

  // The token can vanish under us (concurrent re-analysis shifting indexes).
  $effect(() => {
    if (!token)
      on_close()
  })

  let sense_pick_entry_id = $state<string | null>(null)
  let selected_sense_id = $state('')
  let show_picker = $state(false)
  let busy = $state(false)

  const sense_pick_entry = $derived(sense_pick_entry_id ? $entries_data[sense_pick_entry_id] as EntryData | undefined : undefined)

  function sense_label(sense: EntryData['senses'][number], index: number): string {
    const glosses = Object.values(sense.glosses ?? {}).filter(Boolean).join(', ')
    return glosses || t('token.sense_unnamed', { values: { number: String(index + 1) } })
  }

  function entry_headword(entry: EntryData | undefined): string {
    if (!entry) return ''
    return get_headword({ lexeme: entry.main.lexeme, orthographies: dictionary.orthographies }).value
  }

  function entry_gloss(entry: EntryData | undefined, sense_id?: string): string {
    if (!entry) return ''
    const sense = (sense_id && entry.senses.find(candidate => candidate.id === sense_id)) || entry.senses[0]
    if (!sense) return ''
    return Object.values(sense.glosses ?? {}).filter(Boolean).join(', ')
  }

  function entry_photo(entry: EntryData | undefined): string | null {
    for (const sense of entry?.senses ?? []) {
      const photo = sense.photos?.[0]
      if (photo?.serving_url || photo?.storage_path)
        return photo_src(photo, 's96-p')
    }
    return null
  }

  function begin_confirm(entry_id: string) {
    const senses = ($entries_data[entry_id] as EntryData | undefined)?.senses ?? []
    if (senses.length > 1) {
      sense_pick_entry_id = entry_id
      selected_sense_id = senses[0].id
      return
    }
    void run(() => writes.confirm_token({ sentence_id: sentence.id, orthography, token_index, entry_id, sense_id: senses[0]?.id }))
  }

  async function run(action: () => Promise<unknown>) {
    if (busy) return
    busy = true
    try {
      await action()
    } finally {
      busy = false
      sense_pick_entry_id = null
    }
  }

  function ignore_everywhere() {
    if (!token) return
    const { form } = token
    if (!confirm(t('token.ignore_everywhere_confirm', { values: { form } }))) return
    void run(() => writes.ignore_token({ sentence_id: sentence.id, orthography, token_index, form, everywhere: true }))
  }

  function create_entry() {
    if (!token) return
    void run(() => writes.create_entry_from_token({
      lexeme: { [orthography]: token.form },
      sentence_id: sentence.id,
      orthography,
      token_index,
    }))
  }

  const gloss_values = $derived(Object.values(token?.gloss ?? {}).filter(Boolean))
</script>

{#snippet entry_preview(entry_id: string, sense_id?: string)}
  {@const entry = $entries_data[entry_id] as EntryData | undefined}
  <div class="entry-preview">
    {#if entry_photo(entry)}
      <img class="thumb" src={entry_photo(entry)} alt="" />
    {/if}
    <div class="entry-text">
      <span class="headword">{entry_headword(entry) || '—'}</span>
      {#if entry_gloss(entry, sense_id)}
        <span class="gloss">{entry_gloss(entry, sense_id)}</span>
      {/if}
    </div>
    <a class="view-entry" href={`/${dictionary.url}/entry/${entry_id}`} title={t('token.view_entry')}>
      <IconMdiArrowRight />
    </a>
  </div>
{/snippet}

{#if token && kind}
  <Popover {anchor} {on_close}>
    <div class="head">
      <span class="form">{token.form}</span>
      <span class="status status-{kind}">
        {#if kind === 'auto'}{t('token.suggested_match')}
        {:else if kind === 'confirmed'}{t('token.confirmed')}
        {:else if kind === 'ambiguous'}{t('token.multiple_matches')}
        {:else if kind === 'ignored'}{t('token.ignored')}
        {:else if kind === 'unmatched'}{t('token.not_in_dictionary')}{/if}
      </span>
    </div>

    {#if gloss_values.length || token.morphemes?.length}
      <div class="igt">
        {#if token.morphemes?.length}
          <span class="morphemes">
            {#each token.morphemes as morpheme, morpheme_index (morpheme_index)}{#if morpheme.separator}{morpheme.separator}{/if}{morpheme.form}{/each}
          </span>
        {/if}
        {#if gloss_values.length}
          <span class="gloss-line">{gloss_values.join(' · ')}</span>
        {/if}
      </div>
    {/if}

    {#if sense_pick_entry_id && sense_pick_entry}
      <p class="section-label">{t('token.which_sense')}</p>
      <div class="sense-list">
        {#each sense_pick_entry.senses as sense, sense_index (sense.id)}
          <label class="sense-option">
            <input type="radio" name="token-sense" value={sense.id} bind:group={selected_sense_id} />
            <span>{sense_label(sense, sense_index)}</span>
          </label>
        {/each}
      </div>
      <div class="actions">
        <button type="button" class="btn btn-sm" onclick={() => sense_pick_entry_id = null}>{t('misc.cancel')}</button>
        <button
          type="button"
          class="btn-primary btn-sm"
          disabled={busy}
          onclick={() => run(() => writes.confirm_token({ sentence_id: sentence.id, orthography, token_index, entry_id: sense_pick_entry_id ?? '', sense_id: selected_sense_id }))}>
          {t('token.confirm')}
        </button>
      </div>
    {:else if kind === 'auto' || kind === 'confirmed'}
      {#if token.entry_id}
        {@render entry_preview(token.entry_id, token.sense_id)}
      {/if}
      {#if can_edit}
        <div class="actions">
          {#if kind === 'auto'}
            <button type="button" class="btn-primary btn-sm" disabled={busy} onclick={() => token.entry_id && begin_confirm(token.entry_id)}>{t('token.confirm')}</button>
          {/if}
          <button type="button" class="btn btn-sm" disabled={busy} onclick={() => show_picker = true}>{t('token.change_link')}</button>
          <button type="button" class="btn btn-sm" disabled={busy} onclick={() => run(() => writes.unlink_token({ sentence_id: sentence.id, orthography, token_index }))}>{t('token.remove_link')}</button>
          {#if kind === 'auto'}
            <button type="button" class="btn btn-sm" disabled={busy} onclick={() => run(() => writes.ignore_token({ sentence_id: sentence.id, orthography, token_index }))}>{t('token.ignore')}</button>
          {/if}
        </div>
      {/if}
    {:else if kind === 'ambiguous'}
      <div class="candidate-list">
        {#each token.candidates ?? [] as candidate_id (candidate_id)}
          {#if can_edit}
            <button type="button" class="candidate" disabled={busy} onclick={() => begin_confirm(candidate_id)}>
              {@render entry_preview(candidate_id)}
            </button>
          {:else}
            {@render entry_preview(candidate_id)}
          {/if}
        {/each}
      </div>
      {#if can_edit}
        <div class="actions">
          <button type="button" class="btn btn-sm" disabled={busy} onclick={() => show_picker = true}>{t('token.link_entry')}</button>
          <button type="button" class="btn btn-sm" disabled={busy} onclick={() => run(() => writes.ignore_token({ sentence_id: sentence.id, orthography, token_index }))}>{t('token.ignore')}</button>
        </div>
      {/if}
    {:else if kind === 'unmatched' && can_edit}
      <div class="actions column">
        <button type="button" class="btn-primary btn-sm" disabled={busy} onclick={() => show_picker = true}>{t('token.link_entry')}</button>
        <button type="button" class="btn btn-sm" disabled={busy} onclick={create_entry}>{t('token.create_entry', { values: { form: token.form } })}</button>
        <div class="actions">
          <button type="button" class="btn btn-sm" disabled={busy} onclick={() => run(() => writes.ignore_token({ sentence_id: sentence.id, orthography, token_index }))}>{t('token.ignore')}</button>
          <button type="button" class="btn btn-sm" disabled={busy} onclick={ignore_everywhere}>{t('token.ignore_everywhere')}</button>
        </div>
      </div>
    {:else if kind === 'ignored' && can_edit}
      <div class="actions">
        <button type="button" class="btn btn-sm" disabled={busy} onclick={() => run(() => writes.unlink_token({ sentence_id: sentence.id, orthography, token_index }))}>{t('token.restore')}</button>
        <button type="button" class="btn btn-sm" disabled={busy} onclick={() => show_picker = true}>{t('token.link_entry')}</button>
      </div>
    {/if}
  </Popover>
{/if}

{#if show_picker && token}
  <EntryPickerModal
    initial_query={token.form}
    on_pick={(entry_id) => { show_picker = false; begin_confirm(entry_id) }}
    on_close={() => show_picker = false} />
{/if}

<style>
  .head {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .form {
    font-weight: 700;
    font-size: 1.0625rem;
  }

  .status {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-secondary);
  }

  .status-unmatched {
    color: #b45309;
  }

  .status-ambiguous {
    color: #7c3aed;
  }

  .status-confirmed {
    color: #15803d;
  }

  .igt {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    margin-bottom: 0.5rem;
    font-size: 0.8125rem;
  }

  .morphemes {
    font-style: italic;
  }

  .gloss-line {
    color: var(--color-secondary);
    font-variant: small-caps;
  }

  .entry-preview {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.375rem 0;
    width: 100%;
    text-align: left;
  }

  .thumb {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.375rem;
    object-fit: cover;
    flex-shrink: 0;
  }

  .entry-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex-grow: 1;
  }

  .headword {
    font-weight: 600;
    font-size: 0.9375rem;
  }

  .gloss {
    font-size: 0.8125rem;
    color: var(--color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .view-entry {
    color: var(--primary);
    flex-shrink: 0;
    padding: 0.375rem;
    border-radius: 0.375rem;
  }

  .view-entry:hover {
    background: var(--surface);
  }

  .candidate-list {
    display: flex;
    flex-direction: column;
  }

  .candidate {
    background: none;
    border: 0;
    padding: 0;
    border-radius: 0.375rem;
    cursor: pointer;
    color: inherit;
    font: inherit;
  }

  .candidate:hover {
    background: var(--surface);
  }

  .section-label {
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin: 0.25rem 0;
  }

  .sense-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .sense-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.5rem;
  }

  .actions.column {
    flex-direction: column;
    align-items: stretch;
  }
</style>
