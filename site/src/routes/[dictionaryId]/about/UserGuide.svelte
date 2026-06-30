<script lang="ts">
  import IconMdiChevronDown from '~icons/mdi/chevron-down'
  import IconMdiChevronUp from '~icons/mdi/chevron-up'
  import { slide } from 'svelte/transition'
  import { page } from '$app/state'

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
    <ul transition:slide={{ duration: 300 }}>
      <li>{page.data.t('about.question_1')}</li>
      <li>{page.data.t('about.question_2')}</li>
      <li>{page.data.t('about.question_3')}</li>
      <li>{page.data.t('about.question_4')}</li>
      <li>{page.data.t('about.question_5')}</li>
    </ul>
  {/if}
</div>

<style>
  .guide-card {
    max-width: 550px;
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

  ul {
    list-style-type: disc;
    padding-left: 1.25rem;
    margin-top: 0.5rem;
    line-height: 1.5;
  }

  li {
    margin-bottom: 0.25rem;
  }
</style>
