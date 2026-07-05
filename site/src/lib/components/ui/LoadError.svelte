<script lang="ts">
  // Inline error for a streamed load's {:catch} branch — keeps a failed panel
  // from crashing the whole page into the site-wide error boundary.
  interface Props {
    error?: unknown
    label?: string
  }
  let { error, label = 'Couldn’t load this section.' }: Props = $props()
  const message = $derived(
    error instanceof Error ? error.message : typeof error === 'string' ? error : '',
  )
</script>

<div class="load-error" role="alert">
  <span>{label}</span>
  {#if message}<span class="detail">{message}</span>{/if}
  <button type="button" onclick={() => location.reload()}>Reload</button>
</div>

<style>
  .load-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 0.75rem 1rem;
    border: 1px dashed var(--danger, #dc2626);
    border-radius: 0.625rem;
    background: color-mix(in srgb, var(--danger, #dc2626) 8%, transparent);
    font-size: 0.85rem;
    color: var(--color);
  }
  .detail {
    color: var(--color-secondary);
    font-size: 0.78rem;
  }
  .load-error button {
    margin-left: auto;
    padding: 0.25rem 0.7rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--surface);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    color: inherit;
  }
</style>
