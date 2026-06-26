<script lang="ts">
  import IconMdiEmailArrowRightOutline from '~icons/mdi/email-arrow-right-outline'
  import IconMdiLightbulbOnOutline from '~icons/mdi/lightbulb-on-outline'
  import IconMdiRobotOutline from '~icons/mdi/robot-outline'
  import RoutingLegend from '$lib/admin/RoutingLegend.svelte'
  import { TRIAGE_EXAMPLES } from '$lib/agent/triage/examples'

  // Static curated examples (client-safe — examples.ts imports only types). The
  // admin `+layout.ts` already gates is_admin, so no per-page server load.
  const examples = TRIAGE_EXAMPLES
</script>

<div class="wrap">
  <header class="head">
    <h1><IconMdiRobotOutline style="color: var(--primary)" /> Triage examples</h1>
    <p class="sub">
      The {examples.length} curated few-shot examples fed to the inbound-email classifier as a guide
      for how we triage and reply. Read-only — to change one, send Jacob a link or the new wording.
    </p>
  </header>

  <section class="routing">
    <h2 class="routing-title">Routing — who gets what</h2>
    <RoutingLegend variant="full" />
  </section>

  <ol class="list">
    {#each examples as ex, i (i)}
      <li class="card">
        <div class="inbound">
          <div class="label"><IconMdiEmailArrowRightOutline style="font-size:0.85rem" /> Inbound</div>
          <p class="inbound-text">{ex.inbound}</p>
        </div>

        <div class="badges">
          <span class="badge" class:danger={ex.output.verdict === 'spam'}>{ex.output.verdict}</span>
          <span class="badge muted">{ex.output.category}</span>
          <span class="badge" class:warn={ex.output.confidence === 'low'}>{ex.output.confidence} confidence</span>
        </div>

        <p class="summary">{ex.output.summary}</p>

        <div class="advice">
          <div class="label"><IconMdiLightbulbOnOutline style="font-size:0.85rem" /> Advice</div>
          <div class="advice-body">{ex.output.advice}</div>
        </div>

        <div class="draft">
          <div class="label">Draft reply</div>
          {#if ex.output.draft_reply}
            <div class="draft-body">{ex.output.draft_reply}</div>
          {:else}
            <div class="draft-none">— withheld (no customer draft) —</div>
          {/if}
        </div>

        {#if ex.output.spam_reason}
          <p class="spam-reason"><strong>Spam reason:</strong> {ex.output.spam_reason}</p>
        {/if}
      </li>
    {/each}
  </ol>
</div>

<style>
  .wrap {
    max-width: 820px;
    margin: 0 auto;
    width: 100%;
  }
  .head h1 {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 1.4rem;
    font-weight: 700;
  }
  .sub {
    color: var(--color-secondary);
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }
  .routing {
    margin-top: 1.25rem;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface);
    border: 1px solid var(--border-color);
  }
  .routing-title {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-secondary);
    margin: 0 0 0.5rem;
  }
  .list {
    list-style: none;
    padding: 0;
    margin: 1.25rem 0 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .card {
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface);
    border: 1px solid var(--border-color);
  }
  .label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-secondary);
    margin-bottom: 0.3rem;
  }
  .inbound-text {
    white-space: pre-wrap;
    font-size: 0.875rem;
    line-height: 1.55;
    margin: 0;
    color: var(--color);
  }
  .badges {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin: 0.75rem 0 0.5rem;
  }
  .badge {
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
  .summary {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color);
  }
  .advice, .draft {
    margin-top: 0.6rem;
    padding: 0.6rem 0.75rem;
    border-radius: 0.5rem;
    background: var(--background);
  }
  .advice-body, .draft-body {
    white-space: pre-wrap;
    font-size: 0.85rem;
    line-height: 1.6;
    color: var(--color);
  }
  .draft-body {
    border-left: 2px dashed var(--border-color);
    padding-left: 0.6rem;
  }
  .draft-none {
    font-size: 0.85rem;
    font-style: italic;
    color: var(--color-secondary);
  }
  .spam-reason {
    margin: 0.6rem 0 0;
    font-size: 0.8rem;
    color: var(--danger);
  }
</style>
