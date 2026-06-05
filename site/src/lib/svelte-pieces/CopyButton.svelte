<script lang="ts">
  import IconMdiCheck from '~icons/mdi/check'
  import IconMdiContentCopy from '~icons/mdi/content-copy'

  interface Props {
    value: string
    label?: string
    class?: string
  }

  let { value, label = 'Copy', class: classes = '' }: Props = $props()

  let copied = $state(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  async function copy(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      copied = true
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { copied = false }, 1500)
    } catch (error) {
      console.error('Failed to copy to clipboard', error)
    }
  }
</script>

<button
  type="button"
  onclick={copy}
  title={copied ? 'Copied!' : label}
  aria-label={copied ? 'Copied!' : label}
  class={['copy-button', classes]}>
  {#if copied}
    <IconMdiCheck style="color: var(--success)" />
  {:else}
    <IconMdiContentCopy style="font-size: 0.75rem" />
  {/if}
</button>

<style>
  .copy-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0.25rem;
    color: var(--color-secondary);
    transition: color 0.15s, background-color 0.15s;
  }
  .copy-button:hover {
    color: var(--primary);
    background: var(--surface);
  }
</style>
