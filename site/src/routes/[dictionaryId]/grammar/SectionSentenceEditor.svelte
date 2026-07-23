<script lang="ts">
  import { page } from '$app/state'
  import GrammarExampleSentence from './GrammarExampleSentence.svelte'
  import { move_down_key, move_up_key } from './grammar-tree'
  import { get_headword, get_orthographies } from '$lib/orthography/orthographies'
  import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'
  import IconMdiChevronUp from '~icons/mdi/chevron-up'
  import IconMdiChevronDown from '~icons/mdi/chevron-down'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiMagnify from '~icons/mdi/magnify'

  interface Props {
    section_id: string
  }

  const { section_id }: Props = $props()

  const { t, dictionary, dict_db, writes } = $derived(page.data)
  const orthographies = $derived(get_orthographies(dictionary ?? {}))

  // Ordered junction rows for this section (reactive over the live collection).
  const links = $derived([...(dict_db?.section_sentences.rows ?? [])]
    .filter(link => link.section_id === section_id)
    .sort((first, second) => (first.sort_key || '').localeCompare(second.sort_key || '')))

  const attached_ids = $derived(new Set(links.map(link => link.sentence_id)))

  function sentence_of(sentence_id: string): DictRowType<'sentences'> | undefined {
    return dict_db?.sentences.id(sentence_id)
  }

  let search_text = $state('')
  const results = $derived.by(() => {
    const query = search_text.trim().toLowerCase()
    if (!query) return []
    return (dict_db?.sentences.rows ?? [])
      .filter(sentence => !attached_ids.has(sentence.id)
        && get_headword({ lexeme: sentence.text, orthographies: dictionary.orthographies }).value.toLowerCase().includes(query))
      .slice(0, 6)
  })

  async function attach(sentence_id: string) {
    const last = links.length ? links[links.length - 1].sort_key : null
    await writes.attach_section_sentence({ section_id, sentence_id, after_sort_key: last })
    search_text = ''
  }

  let paste_text = $state('')
  let creating = $state(false)
  async function quick_create() {
    const value = paste_text.trim()
    if (!value || creating) return
    creating = true
    try {
      const [sentence] = await dict_db.sentences.insert({ text: { [orthographies.primary.code]: value } })
      if (sentence) await attach(sentence.id)
      paste_text = ''
    } finally {
      creating = false
    }
  }

  async function detach(sentence_id: string) {
    await writes.detach_section_sentence({ section_id, sentence_id })
  }

  async function reorder(index: number, direction: 'up' | 'down') {
    const keys = links.map(link => link.sort_key)
    const sort_key = direction === 'up' ? move_up_key(keys, index) : move_down_key(keys, index)
    if (!sort_key) return
    const row = links[index]
    row.sort_key = sort_key
    await row._save()
  }
</script>

<div class="sentence-editor">
  <span class="field-label">{t('grammar.example_sentences')}</span>

  {#if links.length}
    <ul class="attached">
      {#each links as link, index (link.id)}
        {@const sentence = sentence_of(link.sentence_id)}
        <li class="attached-row">
          <div class="attached-body">
            {#if sentence}
              <GrammarExampleSentence {sentence} link={false} />
            {:else}
              <span class="missing">{link.sentence_id}</span>
            {/if}
          </div>
          <div class="row-controls">
            <button type="button" class="ctrl" title={t('grammar.move_up')} aria-label={t('grammar.move_up')} disabled={index === 0} onclick={() => reorder(index, 'up')}>
              <IconMdiChevronUp />
            </button>
            <button type="button" class="ctrl" title={t('grammar.move_down')} aria-label={t('grammar.move_down')} disabled={index >= links.length - 1} onclick={() => reorder(index, 'down')}>
              <IconMdiChevronDown />
            </button>
            <button type="button" class="ctrl danger" title={t('grammar.detach_sentence')} aria-label={t('grammar.detach_sentence')} onclick={() => detach(link.sentence_id)}>
              <IconMdiClose />
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="attach-existing">
    <div class="search-wrap">
      <IconMdiMagnify class="sentence-search-icon" />
      <input type="search" class="search-input" placeholder={t('grammar.attach_existing_sentence')} bind:value={search_text} />
    </div>
    {#if results.length}
      <div class="results">
        {#each results as sentence (sentence.id)}
          <button type="button" class="result-row" onclick={() => attach(sentence.id)}>
            {get_headword({ lexeme: sentence.text, orthographies: dictionary.orthographies }).value || '—'}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="quick-create">
    <input
      type="text"
      class="paste-input"
      placeholder={t('grammar.paste_new_sentence')}
      bind:value={paste_text}
      onkeydown={(event) => { if (event.key === 'Enter') { event.preventDefault(); quick_create() } }} />
    <button type="button" class="btn-outline btn-sm" disabled={!paste_text.trim() || creating} onclick={quick_create}>
      {t('grammar.add_example_sentence')}
    </button>
  </div>
</div>

<style>
  .sentence-editor {
    margin-top: 0.75rem;
  }

  .field-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-secondary);
    margin-bottom: 0.375rem;
  }

  .attached {
    list-style: none;
    padding: 0;
    margin: 0 0 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .attached-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .attached-body {
    flex: 1;
    min-width: 0;
  }

  .missing {
    font-size: 0.8125rem;
    color: var(--color-secondary);
    font-style: italic;
  }

  .row-controls {
    display: flex;
    gap: 0.125rem;
    flex-shrink: 0;
  }

  .ctrl {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.375rem;
    border: 0;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
  }

  .ctrl:hover:not(:disabled) {
    background: var(--surface);
    color: var(--color);
  }

  .ctrl:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .ctrl.danger:hover {
    color: var(--danger);
  }

  .search-wrap {
    position: relative;
    max-width: 22rem;
  }

  :global(.sentence-search-icon) {
    position: absolute;
    left: 0.625rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-secondary);
  }

  .search-input,
  .paste-input {
    width: 100%;
    padding: 0.4rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
    background: var(--background);
    color: var(--color);
    font-size: 0.875rem;
  }

  .search-input {
    padding-left: 2rem;
  }

  .results {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    margin-top: 0.375rem;
    max-width: 22rem;
  }

  .result-row {
    text-align: left;
    padding: 0.375rem 0.5rem;
    border-radius: 0.375rem;
    border: 0;
    background: transparent;
    color: var(--color);
    cursor: pointer;
    font-size: 0.875rem;
  }

  .result-row:hover {
    background: var(--surface);
  }

  .quick-create {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.5rem;
  }

  .quick-create .paste-input {
    flex: 1;
    max-width: 22rem;
  }
</style>
