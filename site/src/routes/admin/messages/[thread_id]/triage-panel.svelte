<script lang="ts">
  import IconMdiBellCheckOutline from '~icons/mdi/bell-check-outline'
  import IconMdiCheckDecagram from '~icons/mdi/check-decagram'
  import IconMdiChevronDown from '~icons/mdi/chevron-down'
  import IconMdiLightbulbOnOutline from '~icons/mdi/lightbulb-on-outline'
  import IconMdiReplyOutline from '~icons/mdi/reply-outline'
  import IconMdiRobotOutline from '~icons/mdi/robot-outline'
  import IconMdiShieldAlertOutline from '~icons/mdi/shield-alert-outline'
  import RoutingLegend from '$lib/admin/RoutingLegend.svelte'
  import { format_relative_time } from '$lib/utils/format-relative-time'
  import { text_to_html } from '$lib/utils/text-to-html'

  interface TriageThread {
    triage_verdict: string | null
    triage_category: string | null
    triage_confidence: string | null
    triage_summary: string | null
    triage_advice: string | null
    triage_draft_reply: string | null
    triage_at: string | null
  }

  interface Props {
    thread: TriageThread
    /** Called with HTML to load into the reply composer. */
    onusedraft: (html: string) => void
  }

  let { thread, onusedraft }: Props = $props()

  const is_spam = $derived(thread.triage_verdict === 'spam')
  const is_notification = $derived(thread.triage_verdict === 'notification')
  const is_low = $derived(thread.triage_confidence === 'low')

  let show_legend = $state(false)

  function use_draft() {
    if (thread.triage_draft_reply)
      onusedraft(text_to_html(thread.triage_draft_reply))
  }
</script>

{#if thread.triage_at}
  <section class="triage" class:spam={is_spam} class:notification={is_notification}>
    <div class="triage-head">
      {#if is_notification}<IconMdiBellCheckOutline />{:else}<IconMdiRobotOutline />{/if}
      <span class="triage-title">{is_notification ? 'Auto-handled' : 'AI triage'}</span>
      {#if thread.triage_verdict && !is_notification}
        <span class="badge" class:danger={is_spam}>
          {#if is_spam}<IconMdiShieldAlertOutline style="font-size:0.8rem" />{/if}
          {thread.triage_verdict}
        </span>
      {/if}
      {#if thread.triage_category}
        <span class="badge muted">{thread.triage_category}</span>
      {/if}
      {#if thread.triage_confidence}
        <span class="badge" class:warn={is_low}>{thread.triage_confidence} confidence</span>
      {/if}
      {#if thread.triage_at}
        <span class="ts" title={thread.triage_at}>{format_relative_time(thread.triage_at)}</span>
      {/if}
    </div>

    {#if thread.triage_summary}
      <p class="summary">{thread.triage_summary}</p>
    {/if}

    {#if is_spam}
      <p class="resolved-note">
        <IconMdiCheckDecagram style="font-size:0.85rem" />
        Auto-resolved as spam — moved out of the inbox. Override by re-opening below if this was wrong.
      </p>
    {:else if is_notification}
      <p class="resolved-note ok">
        <IconMdiCheckDecagram style="font-size:0.85rem" />
        Auto-resolved — an automated notification with no action needed, moved out of the inbox. Re-open below if you need it.
      </p>
    {/if}

    {#if thread.triage_advice}
      <div class="advice">
        <div class="advice-label"><IconMdiLightbulbOnOutline style="font-size:0.85rem" />Advice for you</div>
        <div class="advice-body">{thread.triage_advice}</div>
      </div>
    {/if}

    {#if thread.triage_draft_reply}
      <div class="draft">
        <div class="draft-label">Suggested reply (review before sending)</div>
        <div class="draft-body">{thread.triage_draft_reply}</div>
        <button type="button" class="btn btn-sm use-draft" onclick={use_draft}>
          <IconMdiReplyOutline style="margin-right:0.25rem" />Use draft
        </button>
      </div>
    {/if}

    {#if !is_notification}
      <div class="legend-wrap">
        <button type="button" class="legend-toggle" onclick={() => show_legend = !show_legend}>
          <IconMdiChevronDown style={`transition: transform 0.15s; ${show_legend ? 'transform: rotate(180deg)' : ''}`} />
          Routing — who gets what
        </button>
        {#if show_legend}
          <RoutingLegend variant="compact" />
        {/if}
      </div>
    {/if}
  </section>
{/if}

<style>
  .triage {
    margin-bottom: 1rem;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface);
    border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent);
  }
  .triage.spam {
    border-color: color-mix(in srgb, var(--danger) 35%, transparent);
  }
  .triage.notification {
    border-color: color-mix(in srgb, var(--success) 30%, transparent);
  }
  .triage-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 0.8rem;
    color: var(--color-secondary);
  }
  .triage-title {
    font-weight: 600;
    color: var(--color);
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: capitalize;
    background: color-mix(in srgb, var(--primary) 15%, transparent);
    color: var(--primary);
  }
  .badge.muted {
    background: var(--background);
    color: var(--color-secondary);
  }
  .badge.warn {
    background: color-mix(in srgb, #d97706 18%, transparent);
    color: #b45309;
  }
  .badge.danger {
    background: color-mix(in srgb, var(--danger) 18%, transparent);
    color: var(--danger);
  }
  .ts {
    margin-left: auto;
  }
  .summary {
    margin: 0.6rem 0 0;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color);
  }
  .resolved-note {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--danger);
  }
  .resolved-note.ok {
    color: var(--success);
  }
  .advice {
    margin-top: 0.75rem;
    padding: 0.6rem 0.75rem;
    border-radius: 0.5rem;
    background: var(--background);
  }
  .advice-label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-secondary);
    margin-bottom: 0.35rem;
  }
  .advice-body {
    white-space: pre-wrap;
    font-size: 0.85rem;
    line-height: 1.55;
    color: var(--color);
  }
  .draft {
    margin-top: 0.75rem;
  }
  .draft-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-secondary);
    margin-bottom: 0.35rem;
  }
  .draft-body {
    white-space: pre-wrap;
    font-size: 0.85rem;
    line-height: 1.6;
    padding: 0.6rem 0.75rem;
    border-radius: 0.5rem;
    background: var(--background);
    border: 1px dashed var(--border-color);
    color: var(--color);
  }
  .use-draft {
    margin-top: 0.5rem;
  }
  .legend-wrap {
    margin-top: 0.75rem;
    border-top: 1px solid color-mix(in srgb, var(--color-secondary) 18%, transparent);
    padding-top: 0.5rem;
  }
  .legend-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-weight: 600;
    color: var(--color-secondary);
  }
  .legend-toggle:hover {
    color: var(--color);
  }
</style>
