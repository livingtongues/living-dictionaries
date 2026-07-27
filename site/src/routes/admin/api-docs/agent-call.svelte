<script lang="ts">
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import IconMdiContentCopy from '~icons/mdi/content-copy'
  import IconMdiOpenInNew from '~icons/mdi/open-in-new'

  /**
   * The strip at the top of every docs page naming the ONE live call this page
   * mirrors — so a human reading the docs is reading the agent's transcript.
   */
  const { method = 'GET', path, note }: { method?: string, path: string, note?: string } = $props()

  let copied = $state(false)

  async function copy_curl() {
    const { origin } = window.location
    const auth = path.startsWith('/api/v1/guides') || path === '/api/v1' || path.startsWith('/api/v1/openapi')
      ? ''
      : ` \\\n  -H "Authorization: Bearer ldk_…"`
    await navigator.clipboard.writeText(`curl -s${method === 'GET' ? '' : ` -X ${method}`} ${origin}${path}${auth}`)
    copied = true
    setTimeout(() => (copied = false), 2000)
  }
</script>

<div class="agent-call">
  <span class="label">Your agent fetches</span>
  <code class="method">{method}</code>
  <a class="path" href={path} target="_blank" rel="noreferrer">{path} <IconMdiOpenInNew /></a>
  <HeadlessButton class="btn btn-default btn-sm copy" onclick={copy_curl}>
    <IconMdiContentCopy /> {copied ? 'Copied ✓' : 'curl'}
  </HeadlessButton>
  {#if note}<span class="note">{note}</span>{/if}
</div>

<style>
  .agent-call {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    background: color-mix(in srgb, var(--primary), transparent 92%);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    margin-bottom: 1rem;
    font-size: 0.82rem;
  }
  .label {
    color: var(--color-secondary);
  }
  .method {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--primary);
    border: 1px solid var(--primary);
    border-radius: 0.3rem;
    padding: 0.05rem 0.4rem;
  }
  .path {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .note {
    color: var(--color-secondary);
    flex-basis: 100%;
  }
  .agent-call :global(.copy) {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-left: auto;
  }
</style>
