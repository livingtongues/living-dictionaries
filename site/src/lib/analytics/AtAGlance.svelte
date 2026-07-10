<script lang="ts">
  import type { LogAnalytics } from '$lib/db/server/log-analytics'
  import { build_glance } from './at-a-glance'

  interface Props {
    analytics: LogAnalytics
  }

  const { analytics }: Props = $props()
  const glance = $derived(build_glance({ analytics }))

  // Axis-less micro-sparkline path, normalized to a 120×28 box.
  function spark_path(values: number[], width = 120, height = 26): string {
    if (values.length < 2)
      return ''
    const low = Math.min(...values)
    const range = (Math.max(...values) - low) || 1
    const step = width / (values.length - 1)
    return values.map((value, index) => `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)},${(height - ((value - low) / range) * height).toFixed(1)}`).join(' ')
  }
</script>

<section class="glance" aria-label="At a glance">
  <div class="glance-cards">
    <div class="glance-card">
      <div class="glance-kicker">People</div>
      <div class="glance-headline">{glance.people.headline}</div>
      <div class="glance-sub" class:pos={(glance.people.trend_pct ?? 0) > 0.05} class:neg={(glance.people.trend_pct ?? 0) < -0.05}>
        {glance.people.trend_text}
      </div>
      {#if glance.people.spark.length > 1}
        <svg class="glance-spark" viewBox="0 0 120 26" preserveAspectRatio="none" aria-hidden="true">
          <path d={spark_path(glance.people.spark)} fill="none" stroke="var(--primary)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
        </svg>
      {/if}
    </div>

    <div class="glance-card tone-{glance.experience.tone}">
      <div class="glance-kicker">Experience</div>
      <div class="glance-headline">{glance.experience.headline}</div>
      <div class="glance-sub">{glance.experience.detail}</div>
      {#if glance.experience.pain}
        <div class="glance-pain">Pain point: {glance.experience.pain}</div>
      {/if}
    </div>

    {#if glance.places}
      <div class="glance-card">
        <div class="glance-kicker">Where</div>
        <div class="glance-headline">{glance.places.headline}</div>
        <div class="glance-sub">{glance.places.detail}</div>
      </div>
    {/if}
  </div>

  <div class="glance-attention tone-{glance.attention.tone}">
    <div class="glance-kicker">{glance.attention.tone === 'ok' ? 'All clear' : 'For you'}</div>
    <ul>
      {#each glance.attention.items as item (item.text)}
        <li class="item-{item.tone}"><span class="dot" aria-hidden="true"></span>{item.text}</li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .glance {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .glance-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }
  .glance-card {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-left: 3px solid var(--primary);
    border-radius: 0.625rem;
    padding: 0.75rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .glance-card.tone-ok { border-left-color: var(--success, #16a34a); }
  .glance-card.tone-watch { border-left-color: var(--warning, #d97706); }
  .glance-card.tone-act { border-left-color: var(--danger); }
  .glance-kicker {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-secondary);
  }
  .glance-headline {
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.3;
  }
  .glance-sub {
    font-size: 0.8rem;
    color: var(--color-secondary);
    line-height: 1.45;
  }
  .glance-sub.pos { color: var(--success, #16a34a); font-weight: 600; }
  .glance-sub.neg { color: var(--danger); font-weight: 600; }
  .glance-pain {
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--warning, #d97706);
  }
  .glance-spark {
    width: 100%;
    max-width: 10rem;
    height: 1.6rem;
    margin-top: auto;
    opacity: 0.8;
  }
  .glance-attention {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-left: 3px solid var(--success, #16a34a);
    border-radius: 0.625rem;
    padding: 0.65rem 0.9rem;
  }
  .glance-attention.tone-watch { border-left-color: var(--warning, #d97706); }
  .glance-attention.tone-act { border-left-color: var(--danger); }
  .glance-attention ul {
    margin: 0.35rem 0 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .glance-attention li {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.82rem;
    line-height: 1.45;
  }
  .glance-attention .dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--success, #16a34a);
    transform: translateY(-0.05rem);
  }
  .glance-attention .item-watch .dot { background: var(--warning, #d97706); }
  .glance-attention .item-act .dot { background: var(--danger); }
  @media (max-width: 48rem) {
    .glance-cards { grid-template-columns: 1fr; }
  }
</style>
