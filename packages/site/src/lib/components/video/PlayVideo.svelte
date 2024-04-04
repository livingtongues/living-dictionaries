<script lang="ts">
  import type { ExpandedVideo } from '@living-dictionaries/types'
  import { Button } from 'svelte-pieces'
  import { createEventDispatcher } from 'svelte'
  import VideoThirdParty from './VideoThirdParty.svelte'
  import { page } from '$app/stores'

  export let lexeme: string
  export let video: ExpandedVideo
  export let can_edit = false

  const dispatch = createEventDispatcher<{
    close: boolean
    deleteVideo: boolean
  }>()
</script>

<div
  on:click={() => dispatch('close')}
  class="fixed inset-0 md:p-3 flex flex-col items-center justify-center"
  style="background: rgba(0, 0, 0, 0.85); z-index: 51; will-change: transform;">
  <div class="h-full flex flex-col justify-center">
    <div
      class="font-semibold text-white p-4 flex justify-between items-center
        absolute top-0 inset-x-0 bg-opacity-25 bg-black">
      <span on:click|stopPropagation>{lexeme}</span>
      <span class="i-fa-solid-times p-3 cursor-pointer" />
    </div>
    {#if video}
      {#if !video.youtubeId && !video.vimeoId}
        <video
          controls
          autoplay
          playsinline
          src={video.storage_url}>
          <track kind="captions" />
        </video>
      {:else}
        <VideoThirdParty {video} />
      {/if}
    {/if}
    <!-- <img class="object-contain max-h-full" alt="Image of {entry.lx}" {src} /> -->
    {#if can_edit}
      <div
        class="p-4 flex justify-between
          items-center absolute bottom-0 inset-x-0 bg-opacity-25 bg-black">
        <Button
          class="ml-auto"
          color="red"
          form="filled"
          onclick={(e) => {
            e.stopPropagation()
            dispatch('deleteVideo')
          }}>
          <span class="i-fa-trash-o" style="margin: -1px 0 2px;" />
          {$page.data.t('misc.delete')}
        </Button>
      </div>
    {/if}
  </div>
</div>

<!-- {#if !video.youtubeId && !video.vimeoId}
        <Button
          href={video.storage_url}
          target="_blank">
          <i class="fas fa-download" />
          <span class="hidden sm:inline"
            >{$page.data.t('misc.download', {
              default: 'Download',
            })}</span>
        </Button>
      {/if} -->
