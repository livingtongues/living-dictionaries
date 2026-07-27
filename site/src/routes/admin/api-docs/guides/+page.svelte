<script lang="ts">
  import AgentCall from '../agent-call.svelte'

  let { data } = $props()
</script>

<AgentCall path="/api/v1/guides" note="Public. Returns each guide's slug, title, and blurb in recommended reading order." />

<p class="lede">
  The primary documentation layer. An agent reads the guide for its job <em>before</em> the
  endpoint reference — guides carry the judgement calls, the reference carries only field shapes.
</p>

<div class="guides">
  {#each data.guides as guide (guide.slug)}
    <a class="guide" href="/admin/api-docs/guides/{guide.slug}">
      <div class="guide-head">
        <code class="slug">{guide.slug}</code>
        <span class="title">{guide.title}</span>
      </div>
      <p class="description">{guide.description}</p>
    </a>
  {/each}
</div>

<style>
  .lede {
    font-size: 0.9rem;
    color: var(--color-secondary);
    margin-bottom: 1rem;
  }
  .guides {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .guide {
    display: block;
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 0.7rem 0.9rem;
    text-decoration: none;
    color: inherit;
  }
  .guide:hover {
    border-color: var(--primary);
  }
  .guide-head {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.3rem;
  }
  .slug {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--primary);
    border: 1px solid var(--primary);
    border-radius: 0.3rem;
    padding: 0 0.35rem;
  }
  .title {
    font-weight: 600;
    font-size: 0.95rem;
  }
  .description {
    font-size: 0.82rem;
    line-height: 1.55;
    color: var(--color-secondary);
  }
</style>
