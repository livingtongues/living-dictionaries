<script lang="ts">
  import type { MapDict } from './types'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { score_record } from '$lib/utils/fuzzy-score'
  import IconMdiMagnify from '~icons/mdi/magnify'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiBookOpenPageVariantOutline from '~icons/mdi/book-open-page-variant-outline'

  interface Props {
    dicts: MapDict[]
  }

  const { dicts }: Props = $props()
  const t = $derived(page.data.t)

  let query = $state('')
  let focused = $state(false)
  let active_index = $state(0)
  let input_element: HTMLInputElement = $state()

  function fold(value: string): string {
    return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  }

  interface Searchable {
    dict: MapDict
    fields: { value: string, weight: number }[]
  }

  const searchable: Searchable[] = $derived(dicts.map(dict => ({
    dict,
    fields: [
      { value: fold(dict.name), weight: 1 },
      { value: fold(dict.url), weight: 0.9 },
      ...dict.alternate_names.map(name => ({ value: fold(name), weight: 0.8 })),
      { value: fold(dict.location ?? ''), weight: 0.5 },
    ],
  })))

  const results = $derived.by(() => {
    const trimmed = query.trim()
    if (!trimmed)
      return []
    return searchable
      .map(({ dict, fields }) => ({ dict, score: score_record(fold(trimmed), fields) }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score || b.dict.entry_count - a.dict.entry_count)
      .slice(0, 8)
      .map(result => result.dict)
  })

  const open = $derived(focused && query.trim().length > 0)

  $effect(() => {
    if (results.length)
      active_index = Math.min(active_index, results.length - 1)
    else
      active_index = 0
  })

  function open_dictionary(dict: MapDict) {
    goto(`/${dict.url}`)
  }

  function on_keydown(event: KeyboardEvent) {
    if (!open)
      return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      active_index = (active_index + 1) % results.length
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      active_index = (active_index - 1 + results.length) % results.length
    } else if (event.key === 'Enter' && results[active_index]) {
      event.preventDefault()
      open_dictionary(results[active_index])
    } else if (event.key === 'Escape') {
      query = ''
      input_element.blur()
    }
  }
</script>

<div class="search" role="search">
  <div class="input-wrap">
    <IconMdiMagnify style="font-size: 1.375rem; color: var(--color-secondary); flex-shrink: 0" />
    <input
      bind:this={input_element}
      bind:value={query}
      type="text"
      placeholder={t('home.find_dictionary')}
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      role="combobox"
      aria-expanded={open}
      aria-controls="hero-search-results"
      aria-autocomplete="list"
      onfocus={() => focused = true}
      onblur={() => setTimeout(() => focused = false, 150)}
      onkeydown={on_keydown} />
    {#if query}
      <button
        type="button"
        class="clear"
        aria-label="Clear"
        onclick={() => { query = ''; input_element.focus() }}>
        <IconMdiClose style="font-size: 1.25rem" />
      </button>
    {/if}
  </div>

  {#if open}
    <ul class="results" id="hero-search-results" role="listbox">
      {#each results as dict, index (dict.id)}
        <li role="option" aria-selected={index === active_index}>
          <button
            type="button"
            class={['result', { active: index === active_index }]}
            onpointerenter={() => active_index = index}
            onclick={() => open_dictionary(dict)}>
            <IconMdiBookOpenPageVariantOutline style="color: var(--color-secondary); flex-shrink: 0" />
            <span class="result-name">{dict.name}</span>
            {#if dict.location}
              <span class="result-location">{dict.location}</span>
            {/if}
            {#if dict.entry_count > 0}
              <span class="result-count">{dict.entry_count.toLocaleString(page.data.locale || 'en')}</span>
            {/if}
          </button>
        </li>
      {:else}
        <li class="no-results">{t('home.no_results')}</li>
      {/each}
      <li class="browse-all">
        <a href="/dictionaries">{t('home.list_of_dictionaries')}</a>
      </li>
    </ul>
  {/if}
</div>

<style>
  .search {
    position: relative;
    width: 100%;
    max-width: 34rem;
  }

  .input-wrap {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0 1.125rem;
    background: var(--surface);
    border-radius: 9999px;
    transition: box-shadow var(--transition-time, 300ms);
  }

  .input-wrap:focus-within {
    box-shadow: 0 0 0 2px var(--primary);
  }

  .input-wrap input {
    flex: 1;
    min-width: 0;
    padding: 0.875rem 0;
    font-size: 1.125rem;
    background: transparent;
    border: none;
    outline: none;
    color: var(--color);
    box-shadow: none;
  }

  .clear {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0.25rem;
    margin-inline-start: 0.25rem;
    border: none;
    border-radius: 9999px;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
  }

  .clear:hover {
    background: var(--surface);
    color: var(--color);
  }

  .results {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    z-index: 30;
    max-height: min(85vh, 40rem);
    overflow-y: auto;
    padding: 0.375rem;
    margin: 0;
    list-style: none;
    background: var(--background);
    border: 1px solid var(--border-color);
    border-radius: 1rem;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.18);
  }

  .result {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: none;
    border-radius: 0.625rem;
    background: transparent;
    color: var(--color);
    font-size: 0.9375rem;
    text-align: start;
    cursor: pointer;
  }

  .result.active {
    background: var(--surface);
  }

  .result-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-location {
    flex: 1;
    min-width: 0;
    color: var(--color-secondary);
    font-size: 0.8125rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-count {
    margin-inline-start: auto;
    color: var(--color-secondary);
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }

  .no-results {
    padding: 0.75rem;
    color: var(--color-secondary);
    font-size: 0.9375rem;
  }

  .browse-all {
    border-top: 1px solid var(--border-color);
    margin-top: 0.375rem;
    padding: 0.5rem 0.75rem;
  }

  .browse-all a {
    font-size: 0.8125rem;
    color: var(--primary);
    text-decoration: none;
  }
</style>
