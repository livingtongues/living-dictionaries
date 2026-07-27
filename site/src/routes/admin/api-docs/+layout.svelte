<script lang="ts">
  import { page } from '$app/state'
  import IconMdiRobotOutline from '~icons/mdi/robot-outline'

  let { children } = $props()

  /**
   * The docs are a ROUTE TREE mirroring the agent's hops (front door → guide →
   * reference), so this nav is literally the agent's journey: each step is one
   * live call. Don't flatten it back into a single page.
   */
  const steps = [
    { href: '/admin/api-docs', label: 'Front door', hint: 'GET /api/v1' },
    { href: '/admin/api-docs/guides', label: 'Guides', hint: '/api/v1/guides' },
    { href: '/admin/api-docs/reference', label: 'Reference', hint: 'openapi.json' },
    { href: '/admin/api-docs/schemas', label: 'Schemas', hint: '?view=full' },
  ]

  const current = $derived(page.url.pathname)
  function is_active(href: string): boolean {
    return href === '/admin/api-docs' ? current === href : current.startsWith(href)
  }
</script>

<svelte:head><title>Agent API · Admin</title></svelte:head>

<div class="root">
  <header class="header">
    <IconMdiRobotOutline class="title-icon" />
    <div>
      <h1 class="page-title">Agent API</h1>
      <p class="subtitle">The same journey an agent walks — every page here mirrors one live call.</p>
    </div>
  </header>

  <nav class="steps">
    {#each steps as step, index (step.href)}
      <a href={step.href} class="step" class:active={is_active(step.href)}>
        <span class="step-num">{index + 1}</span>
        <span class="step-label">{step.label}</span>
        <code class="step-hint">{step.hint}</code>
      </a>
      {#if index < steps.length - 1}<span class="arrow">→</span>{/if}
    {/each}
  </nav>

  {@render children()}
</div>

<style>
  .root {
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    padding: 0.75rem;
  }
  .header {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    margin-bottom: 1rem;
  }
  :global(.title-icon) {
    font-size: 2rem;
    color: var(--primary);
    flex-shrink: 0;
  }
  .page-title {
    font-size: 1.5rem;
    font-weight: 600;
  }
  .subtitle {
    font-size: 0.875rem;
    color: var(--color-secondary);
    margin-top: 0.25rem;
  }
  .steps {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 1.25rem;
  }
  .step {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    text-decoration: none;
    color: var(--color-secondary);
    background: var(--surface);
    font-size: 0.85rem;
  }
  .step:hover {
    color: var(--primary);
    border-color: var(--primary);
  }
  .step.active {
    color: var(--primary);
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary), transparent 92%);
  }
  .step-num {
    font-size: 0.68rem;
    font-weight: 700;
    background: color-mix(in srgb, currentColor, transparent 88%);
    border-radius: 999px;
    width: 1.15rem;
    height: 1.15rem;
    display: grid;
    place-items: center;
  }
  .step-label {
    font-weight: 600;
  }
  .step-hint {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    opacity: 0.7;
  }
  .arrow {
    color: var(--color-secondary);
    font-size: 0.8rem;
  }
  @media (max-width: 640px) {
    .arrow, .step-hint {
      display: none;
    }
  }
</style>
