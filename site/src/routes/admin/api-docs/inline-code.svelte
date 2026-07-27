<script lang="ts">
  /**
   * Renders the `backticked` spans of a plain string as <code>. The front-door
   * document is markdown-flavoured prose written for agents; a human reading the
   * same text shouldn't see raw backticks.
   */
  const { text }: { text: string } = $props()

  const parts = $derived(text.split('`'))
</script>

{#each parts as part, index (index)}{#if index % 2}<code>{part}</code>{:else}{part}{/if}{/each}

<style>
  code {
    font-family: var(--font-mono);
    font-size: 0.88em;
    background: color-mix(in srgb, var(--color) 8%, transparent);
    border-radius: 0.25rem;
    padding: 0.05em 0.3em;
  }
</style>
