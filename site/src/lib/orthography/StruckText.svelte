<script lang="ts">
  import { split_struck_segments } from './struck-text'

  interface Props {
    text: string
  }

  const { text }: Props = $props()

  const segments = $derived(split_struck_segments(text))
</script>

<!-- base+U+0336 clusters render as a drawn strike: fonts misplace the raw
     combining overlay (Segoe UI drops it below/right of the base letter), and
     CSS line-through has no offset — so the ::after line is positioned by hand.
     `top` is the knob: em-based so the strike scales with every font size. -->
{#each segments as segment}
  {#if segment.struck}<span class="struck">{segment.text}</span>{:else}{segment.text}{/if}
{/each}

<style>
  .struck {
    position: relative;
  }

  .struck::after {
    content: '';
    position: absolute;
    left: -0.02em;
    right: -0.02em;
    top: 0.8em;
    border-top: 0.07em solid currentColor;
  }
</style>
