<script lang="ts">
  import type { FeaturedEntry, FeaturedEntryStatus } from '$lib/db/server/featured-entries'
  import type { PageData } from './$types'
  import { PUBLIC_STORAGE_BUCKET } from '$env/static/public'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { api_admin_featured_entries_set_status } from '$api/admin/featured-entries/_call'
  import { image_src, url_from_storage_path } from '$lib/utils/media-url'
  import { read_choice_param, update_query_params } from '$lib/utils/url-search-params'
  import IconMdiPlay from '~icons/mdi/play'
  import IconMdiPause from '~icons/mdi/pause'
  import IconMdiCheck from '~icons/mdi/check'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiUndoVariant from '~icons/mdi/undo-variant'
  import IconMdiOpenInNew from '~icons/mdi/open-in-new'

  interface Props {
    data: Omit<PageData, 'featured_entries'> & { featured_entries: Awaited<PageData['featured_entries']> }
  }

  const { data }: Props = $props()

  let rows = $derived(data.featured_entries.map(row => ({ ...row })))

  type Tab = FeaturedEntryStatus | 'all'
  const TABS = ['suggested', 'approved', 'rejected', 'all'] as const satisfies readonly Tab[]
  const tab = $derived(read_choice_param({ search_params: page.url.searchParams, key: 'status', choices: TABS, fallback: 'suggested' }))
  let action_error = $state('')

  function set_tab(next_tab: Tab) {
    if (next_tab === tab)
      return
    const url = update_query_params({ url: page.url, values: { status: next_tab }, defaults: { status: 'suggested' } })
    void goto(url, { keepFocus: true, noScroll: true })
  }

  const counts = $derived({
    suggested: rows.filter(row => row.status === 'suggested').length,
    approved: rows.filter(row => row.status === 'approved').length,
    rejected: rows.filter(row => row.status === 'rejected').length,
    all: rows.length,
  })
  const visible = $derived(tab === 'all' ? rows : rows.filter(row => row.status === tab))

  let audio_element: HTMLAudioElement | null = null
  let playing_id = $state<string | null>(null)

  function toggle_audio(row: FeaturedEntry) {
    if (playing_id === row.id) {
      audio_element?.pause()
      playing_id = null
      return
    }
    audio_element?.pause()
    audio_element = new Audio(url_from_storage_path(row.audio_storage_path, PUBLIC_STORAGE_BUCKET))
    audio_element.onended = () => playing_id = null
    audio_element.onerror = () => playing_id = null
    playing_id = row.id
    void audio_element.play()
  }

  function with_status(id: string, status: FeaturedEntryStatus) {
    return rows.map(row => row.id === id ? { ...row, status } : row)
  }

  async function set_status(row: FeaturedEntry, status: FeaturedEntryStatus) {
    const previous = row.status
    rows = with_status(row.id, status)
    action_error = ''
    const { error } = await api_admin_featured_entries_set_status({ ids: [row.id], status })
    if (error) {
      rows = with_status(row.id, previous)
      action_error = error.message
    }
  }
</script>

<svelte:head>
  <title>Featured Words · Admin</title>
</svelte:head>

<div class="page-wrap">
  <h1>Featured words</h1>
  <p class="subtitle">
    Agent-curated entries with photo + audio from public dictionaries. Approved cards ship to the
    homepage word strip on the next deploy (build-time bake). Suggestions come from the
    <code>curate-featured-words</code> command.
  </p>

  <div class="tabs">
    {#each TABS as tab_option (tab_option)}
      <button type="button" class={['btn btn-sm', { 'tab-active': tab === tab_option }]} onclick={() => set_tab(tab_option)}>
        {tab_option} <span class="count">{counts[tab_option]}</span>
      </button>
    {/each}
  </div>

  {#if action_error}
    <p class="error">{action_error}</p>
  {/if}

  {#if visible.length === 0}
    <p class="empty">Nothing here — run the curation command to add suggestions.</p>
  {:else}
    <div class="grid">
      {#each visible as row (row.id)}
        <div class="card">
          <div class="photo-wrap">
            <img src={image_src(row.photo_serving_url, 's400-p')} alt={row.lexeme} loading="lazy" />
            <div class="photo-fade"></div>
            <div class="photo-text">
              <div class="lexeme">{row.lexeme}</div>
              {#if row.gloss}
                <div class="gloss">{row.gloss}{#if row.gloss_language && row.gloss_language !== 'en'}&nbsp;<span class="gloss-lang">({row.gloss_language})</span>{/if}</div>
              {/if}
            </div>
            <button type="button" class="play" onclick={() => toggle_audio(row)} aria-label="Play audio">
              {#if playing_id === row.id}<IconMdiPause />{:else}<IconMdiPlay />{/if}
            </button>
          </div>
          <div class="card-body">
            <a class="dict-link" href="/{row.dict_id}/entry/{row.entry_id}" target="_blank" rel="noreferrer">
              {row.dict_name} <IconMdiOpenInNew style="font-size: 0.75rem" />
            </a>
            <div class="meta-row">
              <span class={['source-badge', { editor: row.source === 'editor_star' }]}>{row.source === 'editor_star' ? 'editor star' : 'agent'}</span>
              {#if row.phonetic}<span>[{row.phonetic}]</span>{/if}
              {#if row.speaker_name}<span>🗣 {row.speaker_name}</span>{/if}
              {#if row.example_sentence}<span title="Has an example sentence">💬</span>{/if}
            </div>
            {#if row.agent_note}
              <p class="note">{row.agent_note}</p>
            {/if}
            <div class="actions">
              {#if row.status !== 'approved'}
                <button type="button" class="btn-primary btn-sm" style="gap: 0.25rem" onclick={() => set_status(row, 'approved')}>
                  <IconMdiCheck /> Approve
                </button>
              {/if}
              {#if row.status !== 'rejected'}
                <button type="button" class="btn btn-sm" style="gap: 0.25rem" onclick={() => set_status(row, 'rejected')}>
                  <IconMdiClose /> Reject
                </button>
              {/if}
              {#if row.status !== 'suggested'}
                <button type="button" class="btn-ghost btn-sm" style="gap: 0.25rem" onclick={() => set_status(row, 'suggested')}>
                  <IconMdiUndoVariant /> Reset
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page-wrap {
    max-width: 80rem;
    margin: 0 auto;
    padding: 1.25rem 1rem 3rem;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
  }

  .subtitle {
    color: var(--color-secondary);
    font-size: 0.875rem;
    margin: 0 0 1rem;
  }

  .tabs {
    display: flex;
    gap: 0.375rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .tabs .tab-active {
    background: var(--primary);
    color: var(--on-primary);
  }

  .count {
    opacity: 0.7;
    margin-inline-start: 0.25rem;
    font-variant-numeric: tabular-nums;
  }

  .error {
    color: var(--danger);
    font-size: 0.875rem;
  }

  .empty {
    color: var(--color-secondary);
    padding: 2rem 0;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: 0.75rem;
  }

  .card {
    background: var(--surface);
    border-radius: 0.75rem;
    overflow: hidden;
  }

  .photo-wrap {
    position: relative;
    aspect-ratio: 1;
  }

  .photo-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .photo-fade {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgb(0 0 0 / 0.72) 0%, rgb(0 0 0 / 0.25) 32%, transparent 55%);
  }

  .photo-text {
    position: absolute;
    left: 0.625rem;
    right: 3rem;
    bottom: 0.5rem;
    color: white;
  }

  .lexeme {
    font-weight: 700;
    font-size: 1.0625rem;
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gloss {
    font-size: 0.8125rem;
    opacity: 0.92;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gloss-lang {
    opacity: 0.7;
  }

  .play {
    position: absolute;
    right: 0.5rem;
    bottom: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border: none;
    border-radius: 9999px;
    background: rgb(255 255 255 / 0.25);
    backdrop-filter: blur(4px);
    color: white;
    font-size: 1.125rem;
    cursor: pointer;
    transition: background 200ms, transform 75ms;
  }

  .play:hover {
    background: rgb(255 255 255 / 0.4);
  }

  .play:active {
    transform: scale(0.9);
  }

  .card-body {
    padding: 0.625rem 0.75rem 0.75rem;
  }

  .dict-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8125rem;
    color: var(--primary);
    text-decoration: none;
  }

  .meta-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.375rem;
    font-size: 0.75rem;
    color: var(--color-secondary);
  }

  .source-badge {
    padding: 0.0625rem 0.4375rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--color) 10%, transparent);
    font-weight: 600;
  }

  .source-badge.editor {
    background: color-mix(in srgb, var(--warning) 22%, transparent);
  }

  .note {
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin: 0.375rem 0 0;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .actions {
    display: flex;
    gap: 0.375rem;
    margin-top: 0.625rem;
    flex-wrap: wrap;
  }
</style>
