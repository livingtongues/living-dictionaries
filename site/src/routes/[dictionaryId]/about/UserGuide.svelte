<script lang="ts">
  import IconCarbonCaretDown from '~icons/carbon/caret-down'
  import IconCarbonCaretUp from '~icons/carbon/caret-up'
  import { run } from 'svelte/legacy'

  import { slide } from 'svelte/transition'
  import { page } from '$app/stores'

  let hide_questions = $state(false)
  let parentElement: HTMLDivElement | null = $state(null)
  let h4Element: HTMLDivElement | null = $state(null)
  let centerMargin = $state('0px')

  run(() => {
    if (hide_questions && h4Element) {
      const parentWidth = parentElement.offsetWidth
      const elementWidth = h4Element.offsetWidth
      centerMargin = `${parentWidth / 2 - elementWidth / 2}px`
    }
  })
</script>

<style>
  .center-h4 {
    transition: margin-left 0.2s ease-in-out;
    margin-bottom: 0.75rem;
    font-size: 1.125rem;
    line-height: 1.75rem;
  }

  .guide-card {
    width: 83.3333333333%;
    margin-left: 1.75rem;
    margin-bottom: 0.75rem;
    border: 2px solid rgb(226 232 240); /* slate-200 */
    padding: 0.75rem;
    padding-left: 2rem;
    color: var(--color-secondary); /* ≈ gray-500 (text-gray-5) */
    border-radius: 0.25rem;
  }

  @media (min-width: 640px) {
    .guide-card {
      max-width: 550px;
    }
  }
</style>

<div class="guide-card">
  <div style="display: flex; justify-content: space-between" bind:this={parentElement}>
    <h4 class="center-h4" bind:this={h4Element} style={`margin-left: ${hide_questions ? centerMargin : '0px'}`}>{$page.data.t('misc.guidance')}</h4>
    <button onclick={() => hide_questions = !hide_questions} type="button" style="height: 0">
      {#if hide_questions}
        <IconCarbonCaretDown class="icon-inline" style="opacity: 0.5; font-size: 1.5rem" />
      {:else}
        <IconCarbonCaretUp class="icon-inline" style="opacity: 0.5; font-size: 1.5rem" />
      {/if}
    </button>
  </div>
  {#if !hide_questions}
    <ul style="list-style-type: disc" transition:slide={{ duration: 300 }}>
      <li>{$page.data.t('about.question_1')}</li>
      <li>{$page.data.t('about.question_2')}</li>
      <li>{$page.data.t('about.question_3')}</li>
      <li>{$page.data.t('about.question_4')}</li>
      <li>{$page.data.t('about.question_5')}</li>
    </ul>
  {/if}
</div>
