<script lang="ts">
  import { onMount } from 'svelte'
  import { api_admin_user_translator_languages, api_admin_user_translator_languages_get } from '$api/admin/users/[id]/translator-languages/_call'
  import { get_locale_display_name, TRANSLATABLE_LOCALES } from '$lib/i18n/locales'
  import IconMdiPlus from '~icons/mdi/plus'
  import IconMdiTranslate from '~icons/mdi/translate'
  import IconMdiTrashCanOutline from '~icons/mdi/trash-can-outline'

  interface Props {
    user_id: string
  }

  let { user_id }: Props = $props()

  let locales = $state<string[]>([])
  let loaded = $state(false)
  let busy = $state(false)
  let to_add = $state('')

  const addable = $derived(TRANSLATABLE_LOCALES.filter(locale => !locales.includes(locale)))

  onMount(async () => {
    const { data } = await api_admin_user_translator_languages_get(user_id)
    if (data)
      ({ locales } = data)
    loaded = true
  })

  async function change({ locale, action }: { locale: string, action: 'add' | 'remove' }) {
    busy = true
    const { data, error } = await api_admin_user_translator_languages(user_id, { locale, action })
    busy = false
    if (error) {
      alert(`Could not update translator languages: ${error.message}`)
      return
    }
    ({ locales } = data)
    to_add = ''
  }
</script>

<section class="card">
  <h2 class="card-heading">
    <IconMdiTranslate />Translator languages
    <div class="add-controls">
      <select bind:value={to_add} disabled={busy || !addable.length} aria-label="Language to assign">
        <option value="" disabled>Language…</option>
        {#each addable as locale (locale)}
          <option value={locale}>{get_locale_display_name(locale)}</option>
        {/each}
      </select>
      <button
        type="button"
        class="btn-outline btn-sm"
        disabled={!to_add || busy}
        onclick={() => change({ locale: to_add, action: 'add' })}>
        <IconMdiPlus />
        Add
      </button>
    </div>
  </h2>
  {#if !loaded}
    <p class="card-empty">Loading…</p>
  {:else if locales.length === 0}
    <p class="card-empty">Not a translator. Assign a language to give them the <a href="/translate">/translate</a> dashboard.</p>
  {:else}
    <ul class="locale-list">
      {#each locales as locale (locale)}
        <li class="locale-row">
          <a href="/translate?locale={locale}" class="locale-name">{get_locale_display_name(locale)}</a>
          <span class="locale-code">{locale}</span>
          <button
            type="button"
            title="Remove language"
            aria-label="Remove language"
            disabled={busy}
            onclick={() => change({ locale, action: 'remove' })}
            class="remove-icon-btn">
            <IconMdiTrashCanOutline />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  /* Matches the sibling cards on /admin/users/[user_id] (scoped styles don't cross components). */
  .card {
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface);
  }

  .card-heading {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0 0 0.75rem;
  }

  .add-controls {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .add-controls select {
    font-size: 0.75rem;
    max-width: 9rem;
  }

  .card-empty {
    color: var(--color-secondary);
    font-size: 0.8125rem;
    margin: 0.25rem 0 0;
  }

  .card-empty a {
    color: var(--primary);
  }

  .locale-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .locale-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0;
  }

  .locale-name {
    color: var(--color);
    text-decoration: none;
    font-size: 0.875rem;
  }

  .locale-name:hover {
    color: var(--primary);
  }

  .locale-code {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    color: var(--color-secondary);
  }

  .remove-icon-btn {
    margin-left: auto;
    background: transparent;
    border: 0;
    color: var(--color-secondary);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.375rem;
  }

  .remove-icon-btn:hover {
    color: var(--danger);
    background: color-mix(in srgb, var(--danger) 10%, transparent);
  }
</style>
