<script lang="ts">
  import GuidanceList from './GuidanceList.svelte'
  import IconMdiChevronDown from '~icons/mdi/chevron-down'
  import IconMdiChevronUp from '~icons/mdi/chevron-up'
  import { slide } from 'svelte/transition'
  import { page } from '$app/state'

  /**
   * The collapsible guidance card shown at the top of the About EDITOR. When not
   * editing the same questions are reachable from the header's "Guidance" button
   * (a modal) instead, so a finished About never has a card wedged above it.
   */

  let hide_questions = $state(false)
</script>

<div class="guide-card">
  <div class="guide-header">
    <h4>{page.data.t('misc.guidance')}</h4>
    <button onclick={() => hide_questions = !hide_questions} type="button" class="btn-ghost toggle" aria-label={page.data.t('misc.guidance')}>
      {#if hide_questions}
        <IconMdiChevronDown style="font-size: 1.5rem" />
      {:else}
        <IconMdiChevronUp style="font-size: 1.5rem" />
      {/if}
    </button>
  </div>
  {#if !hide_questions}
    <div transition:slide={{ duration: 300 }} class="list-wrap">
      <GuidanceList />
    </div>
  {/if}
</div>

<style>
  .guide-card {
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    background: var(--surface);
    border-radius: 0.75rem;
    color: var(--color-secondary);
  }

  .guide-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h4 {
    font-size: 1.125rem;
    line-height: 1.75rem;
    font-weight: 500;
    color: var(--color);
  }

  .toggle {
    padding: 0.25rem;
    color: var(--color-secondary);
  }

  .list-wrap {
    margin-top: 0.5rem;
  }
</style>
