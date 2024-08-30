<script lang="ts">
  import { slide } from 'svelte/transition'
  import { page } from '$app/stores'

  let hide_questions = false
  let parentElement: HTMLDivElement | null = null
  let h4Element: HTMLDivElement | null = null
  let centerMargin = '0px'

  $: if (hide_questions && h4Element) {
    const parentWidth = parentElement.offsetWidth
    const elementWidth = h4Element.offsetWidth
    centerMargin = `${parentWidth / 2 - elementWidth / 2}px`
  }
</script>

<style>
  .center-h4 {
    transition: margin-left 0.2s ease-in-out;
  }
</style>

<div class="w-5/6 sm:max-w-[550px] ml-7 mb-3 border-2 border-slate-200 p-3 pl-8 text-gray-5">
  <div class="flex justify-between" bind:this={parentElement}>
    <h4 class="mb-3 text-lg center-h4" bind:this={h4Element} style={`margin-left: ${hide_questions ? centerMargin : '0px'}`}>{$page.data.t('misc.guidance')}</h4>
    <button on:click={() => hide_questions = !hide_questions} type="button" class="h-0">
      {#if hide_questions}
        <span class="i-carbon-caret-down opacity-50 text-2xl" />
      {:else}
        <span class="i-carbon-caret-up opacity-50 text-2xl" />
      {/if}
    </button>
  </div>
  {#if !hide_questions}
    <ul class="list-disc" transition:slide={{ duration: 300 }}>
      <li>{$page.data.t('about.question_1')}</li>
      <li>{$page.data.t('about.question_2')}</li>
      <li>{$page.data.t('about.question_3')}</li>
      <li>{$page.data.t('about.question_4')}</li>
      <li>{$page.data.t('about.question_5')}</li>
    </ul>
  {/if}
</div>
