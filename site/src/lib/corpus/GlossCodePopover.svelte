<script lang="ts">
  import { page } from '$app/state'
  import Popover from '$lib/components/ui/Popover.svelte'

  /**
   * The expansion of one glossing code, anchored to the code the reader tapped.
   * Shared by every surface that lights codes up — interlinear glosses, entry
   * fields, and grammar prose — so an abbreviation always explains itself the
   * same way.
   */

  interface Props {
    code: string
    expansion: string
    anchor: HTMLElement
    on_close: () => void
  }

  const { code, expansion, anchor, on_close }: Props = $props()
  const { t } = $derived(page.data)
</script>

<Popover {anchor} {on_close} max_width="16rem">
  <div class="expansion">
    <span class="expansion-code">{code}</span>
    <span class="expansion-name">{expansion || t('grammar.no_legend_entry')}</span>
  </div>
</Popover>

<style>
  .expansion {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem 0.875rem;
  }

  .expansion-code {
    font-variant-caps: all-small-caps;
    font-feature-settings: 'c2sc', 'smcp';
    letter-spacing: 0.03em;
    font-weight: 700;
    color: var(--color-secondary);
    font-size: 0.875rem;
  }

  .expansion-name {
    font-size: 0.9375rem;
  }
</style>
