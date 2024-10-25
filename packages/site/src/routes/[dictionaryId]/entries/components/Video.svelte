<script lang="ts">
  import type { Tables } from '@living-dictionaries/types'
  import { ShowHide } from 'svelte-pieces'
  import { page } from '$app/stores'

  export let lexeme: string
  export let video: Tables<'videos_view'>
  export let can_edit = false
</script>

<ShowHide let:show let:toggle>
  <div
    class="{$$props.class} hover:bg-gray-200 flex flex-col items-center
      justify-center cursor-pointer select-none text-gray-800"
    on:click={toggle}>
    <span class="i-bi-camera-video text-xl mt-1" />
    <div class="text-sm">
      {$page.data.t('video.view')}
    </div>
  </div>
  {#if show}
    {#await import('$lib/components/video/PlayVideo.svelte') then { default: PlayVideo }}
      <PlayVideo
        {lexeme}
        {video}
        {can_edit}
        on_close={toggle} />
    {/await}
  {/if}
</ShowHide>
