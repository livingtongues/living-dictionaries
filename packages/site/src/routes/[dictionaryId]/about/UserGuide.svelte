<script lang="ts">
  import { slide } from 'svelte/transition'
  import { page } from '$app/stores'

  let hide_questions = false
</script>

<div class="max-w-[600px] ml-7">
  {#if !hide_questions}
    <div class="text-justify" transition:slide={{ duration: 300 }}>
      <ul class="list-disc">
        <li class="text-gray-5">{$page.data.t('about.question_1')}</li>
        <li class="text-gray-5">{$page.data.t('about.question_2')}</li>
        <li class="text-gray-5">{$page.data.t('about.question_3')}</li>
        <li class="text-gray-5">{$page.data.t('about.question_4')}</li>
        <li class="text-gray-5">{$page.data.t('about.question_5')}</li>
      </ul>
      <div class="flex justify-end">
        <button on:click={() => hide_questions = true} type="button"><i class="fal fa-sort-up" /></button>
      </div>
    </div>
  {/if}
  {#if hide_questions}
    <div class="flex justify-end">
      <button on:click={() => hide_questions = false} type="button"><i class="fal fa-sort-down" /></button>
    </div>
  {/if}
</div>
