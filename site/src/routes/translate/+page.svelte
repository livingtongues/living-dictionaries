<script lang="ts">
  import type { TranslateFilter } from '$lib/translate/constants'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { onMount } from 'svelte'
  import Header from '$lib/components/shell/Header.svelte'
  import LoginModal from '$lib/components/LoginModal.svelte'
  import { get_locale_display_name } from '$lib/i18n/locales'
  import ShowHide from '$lib/svelte-pieces/ShowHide.svelte'
  import AdminPanel from '$lib/translate/admin-panel.svelte'
  import { FILTER_LABELS, section_label, TRANSLATE_FILTERS } from '$lib/translate/constants'
  import TranslateRow from '$lib/translate/translate-row.svelte'
  import { translate_store } from '$lib/translate/translate-store.svelte'
  import IconMdiShieldLockOutline from '~icons/mdi/shield-lock-outline'
  import IconMdiTranslate from '~icons/mdi/translate'

  const auth_user = $derived(page.data.auth_user)
  const my_locales = $derived(auth_user.translator_locales)
  const is_admin = $derived(auth_user.admin_level >= 2)

  let active_locale = $state('')
  let filter = $state<TranslateFilter>('all')
  let search = $state('')

  const rows = $derived(translate_store.rows)
  const counts = $derived({
    all: rows.length,
    missing: rows.filter(row => !row.value).length,
    flagged: rows.filter(row => row.needs_review).length,
    pending: rows.filter(row => !row.value || row.needs_review).length,
  })

  const visible_rows = $derived.by(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (filter === 'missing' && row.value)
        return false
      if (filter === 'flagged' && !row.needs_review)
        return false
      if (filter === 'pending' && row.value && !row.needs_review)
        return false
      if (query)
        return row.key_id.toLowerCase().includes(query) || row.en_value.toLowerCase().includes(query) || (row.value ?? '').toLowerCase().includes(query)
      return true
    })
  })

  const sections = $derived.by(() => {
    // Plain Map is fine: built fresh inside the derived, never mutated after return.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const grouped = new Map<string, typeof visible_rows>()
    for (const row of visible_rows) {
      const section = row.key_id.slice(0, row.key_id.indexOf('.'))
      const existing = grouped.get(section)
      if (existing)
        existing.push(row)
      else
        grouped.set(section, [row])
    }
    return [...grouped.entries()].map(([id, section_rows]) => ({ id, label: section_label(id), rows: section_rows }))
  })

  function sync_url() {
    const params = new URLSearchParams()
    if (active_locale)
      params.set('locale', active_locale)
    if (filter !== 'all')
      params.set('filter', filter)
    void goto(`?${params}`, { replaceState: true, keepFocus: true, noScroll: true })
  }

  function pick_locale(locale: string) {
    if (locale === active_locale)
      return
    active_locale = locale
    sync_url()
    void translate_store.load_locale(locale)
  }

  function pick_filter(next: TranslateFilter) {
    filter = next
    sync_url()
  }

  onMount(() => {
    if (!my_locales.length)
      return
    const url_filter = page.url.searchParams.get('filter') as TranslateFilter | null
    if (url_filter && TRANSLATE_FILTERS.includes(url_filter))
      filter = url_filter
    const url_locale = page.url.searchParams.get('locale')
    active_locale = url_locale && my_locales.includes(url_locale) ? url_locale : my_locales[0]
    void translate_store.load_locale(active_locale)
    if (is_admin)
      void translate_store.refresh_summary()
  })
</script>

<svelte:head><title>Translate · Living Dictionaries</title></svelte:head>

<Header>Translate</Header>

{#if !auth_user.user}
  <div class="gate-screen">
    <IconMdiTranslate style="font-size: 2rem; color: var(--primary)" />
    <h1 class="gate-title">Translate</h1>
    <p class="gate-text">Please sign in to continue.</p>
    <ShowHide>
      {#snippet children({ show, toggle })}
        <button type="button" class="btn-primary btn-default" onclick={toggle}>Sign in</button>
        {#if show}
          <LoginModal on_close={toggle} />
        {/if}
      {/snippet}
    </ShowHide>
  </div>
{:else if !my_locales.length}
  <div class="gate-screen">
    <IconMdiShieldLockOutline style="font-size: 2rem; color: var(--color-secondary)" />
    <h1 class="gate-title">Translation is invite-only</h1>
    <p class="gate-text">You're not assigned to any languages yet — an admin can add you.</p>
  </div>
{:else}
  <main>
    <div class="toolbar">
      {#if my_locales.length > 1}
        <select value={active_locale} onchange={event => pick_locale((event.target as HTMLSelectElement).value)}>
          {#each my_locales as locale (locale)}
            <option value={locale}>{get_locale_display_name(locale)}</option>
          {/each}
        </select>
      {:else}
        <div class="single-locale">{get_locale_display_name(active_locale)}</div>
      {/if}
      <div class="filters">
        {#each TRANSLATE_FILTERS as option (option)}
          <button type="button" class={['filter-chip', { active: filter === option }]} onclick={() => pick_filter(option)}>
            {FILTER_LABELS[option]}
            <span class="count">{counts[option]}</span>
          </button>
        {/each}
      </div>
      <input type="search" placeholder="Search keys and text…" bind:value={search} />
    </div>

    {#if is_admin}
      <AdminPanel active_locale={active_locale} on_pick_locale={pick_locale} />
    {/if}

    {#if translate_store.loading}
      <p class="empty">Loading {get_locale_display_name(active_locale)}…</p>
    {:else if !visible_rows.length}
      <p class="empty">
        {#if filter === 'all' && !search}
          Nothing here yet.
        {:else}
          Nothing matches — {filter !== 'all' ? `no "${FILTER_LABELS[filter]}" items` : 'no matches'}{search ? ` for “${search}”` : ''}. 🎉
        {/if}
      </p>
    {:else}
      {#each sections as section (section.id)}
        <section>
          <h2 class="section-head">{section.label} <span class="section-count">{section.rows.length}</span></h2>
          {#each section.rows as row (`${active_locale}:${row.key_id}`)}
            <TranslateRow {row} />
          {/each}
        </section>
      {/each}
    {/if}
  </main>
{/if}

<style>
  main {
    max-width: 64rem;
    margin: 0 auto;
    padding: 1rem 0.75rem 4rem;
  }

  .gate-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 4rem 1rem;
    text-align: center;
  }

  .gate-title {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
  }

  .gate-text {
    color: var(--color-secondary);
    margin: 0;
  }

  .toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .toolbar select {
    max-width: 14rem;
  }

  .toolbar input[type='search'] {
    flex: 1;
    min-width: 10rem;
  }

  .single-locale {
    font-weight: 700;
    padding: 0.375rem 0.25rem;
  }

  .filters {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.375rem 0.625rem;
    border-radius: 999px;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
    transition: background var(--transition-time, 150ms);
  }

  .filter-chip:hover {
    background: var(--surface);
  }

  .filter-chip.active {
    background: color-mix(in srgb, var(--primary) 12%, var(--background));
    color: var(--primary);
  }

  .count {
    font-size: 0.6875rem;
    opacity: 0.8;
  }

  .section-head {
    position: sticky;
    top: 0;
    z-index: 1;
    background: color-mix(in srgb, var(--background) 92%, transparent);
    backdrop-filter: blur(4px);
    font-size: 0.8125rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-secondary);
    margin: 1.25rem 0 0.25rem;
    padding: 0.5rem 0.75rem;
  }

  .section-count {
    font-weight: 500;
    opacity: 0.6;
    margin-left: 0.25rem;
  }

  .empty {
    color: var(--color-secondary);
    text-align: center;
    padding: 3rem 0;
  }
</style>
