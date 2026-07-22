<script lang="ts">
  import type { TranslateFilter } from '$lib/translate/constants'
  import { afterNavigate, goto } from '$app/navigation'
  import { page } from '$app/state'
  import { onMount } from 'svelte'
  import Header from '$lib/components/shell/Header.svelte'
  import LoginModal from '$lib/components/LoginModal.svelte'
  import { get_locale_display_name } from '$lib/i18n/locales'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import AdminPanel from '$lib/translate/admin-panel.svelte'
  import { FILTER_LABELS, section_label, TRANSLATE_FILTERS } from '$lib/translate/constants'
  import TranslateProgress from '$lib/translate/translate-progress.svelte'
  import TranslateRow from '$lib/translate/translate-row.svelte'
  import { translate_store } from '$lib/translate/translate-store.svelte'
  import { read_choice_param, update_query_params } from '$lib/utils/url-search-params'
  import IconMdiInformationOutline from '~icons/mdi/information-outline'
  import IconMdiShieldLockOutline from '~icons/mdi/shield-lock-outline'
  import IconMdiTranslate from '~icons/mdi/translate'

  const auth_user = $derived(page.data.auth_user)
  const my_locales = $derived(auth_user.translator_locales)
  const is_admin = $derived(auth_user.admin_level >= 2)

  const active_locale = $derived.by(() => {
    const url_locale = page.url.searchParams.get('locale')
    return url_locale && my_locales.includes(url_locale) ? url_locale : (my_locales[0] ?? '')
  })
  const filter = $derived(read_choice_param<TranslateFilter>({ search_params: page.url.searchParams, key: 'filter', choices: TRANSLATE_FILTERS, fallback: 'all' }))
  let search = $state(page.url.searchParams.get('q') ?? '')

  const rows = $derived(translate_store.rows)
  const progress_counts = $derived({
    reviewed: rows.filter(row => row.value && !row.needs_review).length,
    ai: rows.filter(row => row.needs_review === 'ai').length,
    en_changed: rows.filter(row => row.needs_review === 'en_changed').length,
    missing: rows.filter(row => !row.value).length,
  })

  const visible_rows = $derived.by(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (filter === 'missing' && row.value)
        return false
      if (filter === 'ai' && row.needs_review !== 'ai')
        return false
      if (filter === 'en_changed' && row.needs_review !== 'en_changed')
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

  function navigate_query({ values, replace_state = false }: { values: Record<string, string | null>, replace_state?: boolean }) {
    const url = update_query_params({
      url: page.url,
      values,
      defaults: { locale: my_locales[0] ?? '', filter: 'all', q: '' },
    })
    void goto(url, { replaceState: replace_state, keepFocus: true, noScroll: true })
  }

  function pick_locale(locale: string) {
    if (locale === active_locale)
      return
    navigate_query({ values: { locale } })
  }

  function pick_filter(next: TranslateFilter) {
    if (next !== filter)
      navigate_query({ values: { filter: next } })
  }

  function set_search(value: string) {
    search = value
    navigate_query({ values: { q: value }, replace_state: true })
  }

  onMount(() => {
    if (!my_locales.length)
      return
    if (is_admin)
      void translate_store.refresh_summary()
  })

  afterNavigate(() => {
    search = page.url.searchParams.get('q') ?? ''
    if (active_locale && translate_store.locale !== active_locale)
      void translate_store.load_locale(active_locale)
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
    {#if is_admin}
      <AdminPanel active_locale={active_locale} on_pick_locale={pick_locale} />
    {/if}

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
      <input type="search" placeholder="Search keys and text…" value={search} oninput={event => set_search(event.currentTarget.value)} />
    </div>

    <TranslateProgress locale={active_locale} counts={progress_counts} total={rows.length} {filter} on_pick_filter={pick_filter} />

    <p class="help">
      <IconMdiInformationOutline style="flex-shrink: 0; color: var(--primary)" />
      <span>
        Type in any box to change a translation — it <strong>saves automatically</strong> when you click away (or press ⌘/Ctrl + Enter), and a “Saved” note confirms it.
        For an AI suggestion flagged for review, click <strong>Looks good</strong> to approve it as-is.
      </span>
    </p>

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
    /* Progress-category palette, inherited by the segmented bars, legend chips and cards below. */
    --cat-reviewed: var(--success);
    --cat-ai: light-dark(hsl(258, 70%, 60%), hsl(258, 78%, 74%));
    --cat-en-changed: var(--warning);
    --cat-missing: light-dark(hsl(240, 5%, 74%), hsl(240, 5%, 42%));
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

  .help {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--color-secondary);
    background: color-mix(in srgb, var(--primary) 6%, var(--background));
    border: 1px solid color-mix(in srgb, var(--primary) 18%, transparent);
    border-radius: 0.625rem;
    padding: 0.5rem 0.75rem;
    margin: 0.75rem 0 1rem;
  }

  .help strong {
    color: var(--color);
    font-weight: 600;
  }
</style>
