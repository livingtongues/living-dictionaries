<script lang="ts">
  import type { LocaleStats } from '$lib/server/i18n/i18n-db'
  import type { ProgressCounts } from './constants'
  import { api_translate_notify } from '$api/translate/notify/_call'
  import { get_locale_display_name } from '$lib/i18n/locales'
  import { toast } from '$lib/state/toast.svelte'
  import { ai_confidence_for, AI_CONFIDENCE_META, is_unpublished_locale } from './constants'
  import SegmentedBar from './segmented-bar.svelte'
  import { translate_store } from './translate-store.svelte'
  import IconMdiAlert from '~icons/mdi/alert'
  import IconMdiBellOutline from '~icons/mdi/bell-outline'
  import IconMdiCheckCircle from '~icons/mdi/check-circle'
  import IconMdiEyeOffOutline from '~icons/mdi/eye-off-outline'
  import IconMdiFlag from '~icons/mdi/flag'
  import IconMdiShieldLockOutline from '~icons/mdi/shield-lock-outline'

  interface Props {
    active_locale: string
    on_pick_locale: (locale: string) => void
  }

  let { active_locale, on_pick_locale }: Props = $props()

  let notifying = $state(false)
  const summary = $derived(translate_store.summary)

  function card_counts(stat: LocaleStats): ProgressCounts {
    return {
      reviewed: stat.translated - stat.flagged,
      ai: stat.flagged_ai,
      en_changed: stat.flagged_en_changed,
      missing: stat.missing,
    }
  }

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

  function translators_for(locale: string): string[] {
    return (summary?.translators ?? [])
      .filter(translator => translator.locales.includes(locale))
      .map(translator => translator.name || translator.email)
  }
</script>

{#if summary}
  <div class="panel">
    <div class="panel-head">
      <h2>Progress <span class="admin-badge" title="Admin only — translators don't see this panel"><IconMdiShieldLockOutline /></span></h2>
      <button type="button" class="btn-primary btn-sm" style="gap: 0.375rem" disabled={notifying} onclick={notify}>
        <IconMdiBellOutline /> {notifying ? 'Notifying…' : 'Notify translators'}
      </button>
    </div>
    <div class="grid">
      {#each summary.locales as stat (stat.locale)}
        {@const translator_names = translators_for(stat.locale)}
        {@const confidence = ai_confidence_for(stat.locale)}
        <button type="button" class={['locale-card', translator_names.length ? 'assigned' : 'unassigned', { active: stat.locale === active_locale }]} onclick={() => on_pick_locale(stat.locale)}>
          <div class="card-head">
            <span class="locale-name">{get_locale_display_name(stat.locale)}</span>
            <span class="status">
              {#if is_unpublished_locale(stat.locale)}
                <span class="status-icon unpublished" title="Unpublished — not yet public"><IconMdiEyeOffOutline /></span>
              {/if}
              {#if confidence === 'confident'}
                <span class="status-icon conf-confident" title={AI_CONFIDENCE_META.confident.tooltip}><IconMdiCheckCircle /></span>
              {:else if confidence === 'decent'}
                <span class="status-icon conf-decent" title={AI_CONFIDENCE_META.decent.tooltip}><IconMdiAlert /></span>
              {:else if confidence === 'low'}
                <span class="status-icon conf-low" title={AI_CONFIDENCE_META.low.tooltip}><IconMdiFlag /></span>
              {/if}
            </span>
          </div>
          <SegmentedBar counts={card_counts(stat)} total={stat.total} size="mini" />
          <div class="counts">
            <span>{stat.translated}/{stat.total}</span>
            {#if stat.flagged}<span class="flagged-count">{stat.flagged} to review</span>{/if}
            {#if translator_names.length}
              <span class="who">{translator_names.join(', ')}</span>
            {:else}
              <span class="no-translator">No translator</span>
            {/if}
          </div>
        </button>
      {/each}
    </div>
    <div class="legend" title="AI-translation trust per language">
      <span class="legend-label">AI drafts:</span>
      <span class="legend-item"><span class="status-icon conf-confident"><IconMdiCheckCircle /></span>{AI_CONFIDENCE_META.confident.label}</span>
      <span class="legend-item"><span class="status-icon conf-decent"><IconMdiAlert /></span>{AI_CONFIDENCE_META.decent.label}</span>
      <span class="legend-item"><span class="status-icon conf-low"><IconMdiFlag /></span>{AI_CONFIDENCE_META.low.label}</span>
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
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0;
  }

  .admin-badge {
    display: inline-flex;
    color: var(--color-secondary);
    font-size: 0.9375rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.5rem;
  }

  .locale-card {
    text-align: left;
    background: var(--background);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 0.5rem 0.625rem;
    cursor: pointer;
    transition: border-color var(--transition-time, 150ms), background var(--transition-time, 150ms);
  }

  .locale-card.assigned {
    background: color-mix(in srgb, var(--success) 6%, var(--background));
    border-color: color-mix(in srgb, var(--success) 24%, var(--border-color));
  }

  .locale-card.unassigned {
    background: color-mix(in srgb, var(--warning) 7%, var(--background));
    border-color: color-mix(in srgb, var(--warning) 28%, var(--border-color));
  }

  .locale-card.active {
    border-color: var(--primary);
    box-shadow: 0 0 0 1px var(--primary);
  }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    margin-bottom: 0.375rem;
  }

  .locale-name {
    font-size: 0.8125rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    flex: 0 0 auto;
    font-size: 0.875rem;
  }

  .status-icon {
    display: inline-flex;
  }

  .status-icon.unpublished {
    color: var(--color-secondary);
  }

  .status-icon.conf-confident {
    color: var(--success);
  }

  .status-icon.conf-decent {
    color: var(--warning);
  }

  .status-icon.conf-low {
    color: var(--danger);
  }

  .counts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.375rem;
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
    color: color-mix(in srgb, var(--success) 72%, var(--color));
    font-weight: 600;
  }

  .no-translator {
    color: color-mix(in srgb, var(--warning) 74%, var(--color));
    font-weight: 600;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.75rem;
    margin-top: 0.75rem;
    font-size: 0.6875rem;
    color: var(--color-secondary);
  }

  .legend-label {
    font-weight: 600;
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .legend-item .status-icon {
    font-size: 0.8125rem;
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
