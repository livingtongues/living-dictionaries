<script lang="ts">
  import { api_translate_notify } from '$api/translate/notify/_call'
  import { get_locale_display_name } from '$lib/i18n/locales'
  import { toast } from '$lib/svelte-pieces/toast.svelte'
  import { translate_store } from './translate-store.svelte'
  import IconMdiBellOutline from '~icons/mdi/bell-outline'

  interface Props {
    active_locale: string
    on_pick_locale: (locale: string) => void
  }

  let { active_locale, on_pick_locale }: Props = $props()

  let notifying = $state(false)
  const summary = $derived(translate_store.summary)

  async function notify() {
    const pending_total = summary?.locales.reduce((sum, stat) => sum + stat.missing + stat.flagged, 0) ?? 0
    if (!confirm(`Email every translator who has pending work? (${pending_total} open items across all languages)`))
      return
    notifying = true
    const { data, error } = await api_translate_notify()
    notifying = false
    if (error) {
      toast.error(`Notify failed: ${error.message}`)
      return
    }
    if (!data.notified.length) {
      toast('No translators have pending work (or none are assigned).')
      return
    }
    toast.success(`Emailed ${data.notified.map(person => `${person.name || person.email} (${person.total_pending})`).join(', ')}`)
  }

  function translators_for(locale: string): string {
    const names = (summary?.translators ?? [])
      .filter(translator => translator.locales.includes(locale))
      .map(translator => translator.name || translator.email)
    return names.join(', ')
  }
</script>

{#if summary}
  <div class="panel">
    <div class="panel-head">
      <h2>Progress</h2>
      <button type="button" class="btn-primary btn-sm" style="gap: 0.375rem" disabled={notifying} onclick={notify}>
        <IconMdiBellOutline /> {notifying ? 'Notifying…' : 'Notify translators'}
      </button>
    </div>
    <div class="grid">
      {#each summary.locales as stat (stat.locale)}
        <button type="button" class={['locale-card', { active: stat.locale === active_locale }]} onclick={() => on_pick_locale(stat.locale)}>
          <div class="locale-name">{get_locale_display_name(stat.locale)}</div>
          <div class="bar"><div class="fill" style:width="{stat.total ? Math.round((stat.translated / stat.total) * 100) : 0}%"></div></div>
          <div class="counts">
            <span>{stat.translated}/{stat.total}</span>
            {#if stat.flagged}<span class="flagged-count">{stat.flagged} to review</span>{/if}
            {#if translators_for(stat.locale)}<span class="who">{translators_for(stat.locale)}</span>{/if}
          </div>
        </button>
      {/each}
    </div>
    {#if !summary.translators.length}
      <p class="hint">No translators assigned yet — pick people on their <a href="/admin/users">admin user page</a>.</p>
    {/if}
  </div>
{/if}

<style>
  .panel {
    background: var(--surface);
    border-radius: 0.75rem;
    padding: 0.75rem;
    margin-bottom: 1rem;
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .panel-head h2 {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.5rem;
  }

  .locale-card {
    text-align: left;
    background: var(--background);
    border: 1px solid transparent;
    border-radius: 0.5rem;
    padding: 0.5rem 0.625rem;
    cursor: pointer;
    transition: border-color var(--transition-time, 150ms);
  }

  .locale-card.active {
    border-color: var(--primary);
  }

  .locale-name {
    font-size: 0.8125rem;
    font-weight: 600;
    margin-bottom: 0.375rem;
  }

  .bar {
    height: 4px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--color-secondary) 18%, var(--background));
    overflow: hidden;
    margin-bottom: 0.375rem;
  }

  .fill {
    height: 100%;
    background: var(--primary);
    border-radius: 2px;
  }

  .counts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    font-size: 0.6875rem;
    color: var(--color-secondary);
  }

  .flagged-count {
    color: color-mix(in srgb, var(--warning) 70%, var(--color));
    font-weight: 600;
  }

  .who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .hint {
    margin: 0.75rem 0 0;
    font-size: 0.75rem;
    color: var(--color-secondary);
  }

  .hint a {
    color: var(--primary);
  }
</style>
