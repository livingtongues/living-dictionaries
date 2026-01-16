<script lang="ts">
  import type { EntryData } from '@living-dictionaries/types'
  import { ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/state'

  let { lexeme, video, can_edit = false, class: class_prop = '' }: {
    lexeme: string
    video: EntryData['senses'][0]['videos'][0]
    can_edit?: boolean
    class?: string
  } = $props()
</script>

<ShowHide let:show let:toggle>
  <div
    class="{class_prop} hover:bg-gray-200 flex flex-col items-center
      justify-center cursor-pointer select-none text-gray-800"
    onclick={toggle}>
    <span class="i-bi-camera-video text-xl mt-1" />
    <div class="text-sm">
      {page.data.t('video.view')}
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
