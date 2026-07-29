<script lang="ts">
  import { page } from '$app/state'
  import { slide } from 'svelte/transition'
  import GrammarToc from './GrammarToc.svelte'
  import type { TocEntry } from './grammar-toc'
  import IconMdiFormatListBulleted from '~icons/mdi/format-list-bulleted'
  import IconMdiChevronDown from '~icons/mdi/chevron-down'

  /**
   * Narrow-viewport table of contents: a bar that sticks under the site header
   * naming the section you're currently in, tapping it drops the full TOC over
   * the page. Doing double duty as a "you are here" readout is the point — deep
   * in a 19-chapter grammar, knowing where you are matters as much as jumping.
   */

  interface Props {
    entries: TocEntry[]
    breadcrumb: { number: string, label: string } | null
  }

  const { entries, breadcrumb }: Props = $props()
  const { t } = $derived(page.data)

  let open = $state(false)
</script>

<div class="toc-bar">
  <button type="button" class="bar-button" onclick={() => open = !open} aria-expanded={open}>
    <IconMdiFormatListBulleted style="flex-shrink: 0" />
    <span class="crumb">
      {#if breadcrumb}
        <span class="crumb-number">{breadcrumb.number}</span>
        {breadcrumb.label}
      {:else}
        {t('dictionary.grammar')}
      {/if}
    </span>
    <IconMdiChevronDown class="chevron" style={`flex-shrink: 0; transition: transform 200ms; transform: rotate(${open ? 180 : 0}deg)`} />
  </button>

  {#if open}
    <button type="button" class="scrim" aria-label={t('misc.close')} onclick={() => open = false}></button>
    <div class="panel" transition:slide={{ duration: 200 }}>
      <GrammarToc {entries} on_navigate={() => open = false} />
    </div>
  {/if}
</div>

<style>
  .toc-bar {
    position: sticky;
    top: 3rem;
    z-index: 20;
    /* the padding keeps the bar's own background under the panel's top gap */
    padding-bottom: 0.375rem;
    margin-bottom: 0.375rem;
    background: var(--background);
  }

  .bar-button {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 0;
    border-radius: 0.5rem;
    background: var(--surface);
    color: var(--color-secondary);
    font-size: 0.8125rem;
    text-align: start;
    cursor: pointer;
  }

  .crumb {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color);
  }

  .crumb-number {
    font-variant-numeric: tabular-nums;
    color: var(--color-secondary);
    margin-right: 0.25rem;
  }

  .scrim {
    position: fixed;
    inset: 0;
    z-index: 0;
    border: 0;
    background: transparent;
  }

  .panel {
    position: absolute;
    z-index: 1;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 65vh;
    overflow-y: auto;
    padding: 0.5rem;
    border-radius: 0.5rem;
    background: var(--background);
    box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.25), 0 0 0 1px var(--border-color);
  }

  @media (min-width: 1024px) {
    .toc-bar {
      display: none;
    }
  }

  @media print {
    .toc-bar {
      display: none;
    }
  }
</style>
