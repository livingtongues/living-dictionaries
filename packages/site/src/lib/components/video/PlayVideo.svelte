<script lang="ts">
  import type { Tables } from '@living-dictionaries/types'
  import { Button } from 'svelte-pieces'
  import VideoThirdParty from './VideoThirdParty.svelte'
  import { page } from '$app/stores'

  $: ({ dbOperations, url_from_storage_path } = $page.data)

  export let lexeme: string
  export let video: Tables<'videos_view'>
  export let can_edit = false
  export let on_close: () => void
</script>

<div
  on:click={on_close}
  class="fixed inset-0 md:p-3 flex flex-col items-center justify-center"
  style="background: rgba(0, 0, 0, 0.85); z-index: 51; will-change: transform;">
  <div class="h-full flex flex-col justify-center">
    <div
      class="font-semibold text-white p-4 flex justify-between items-center
        absolute top-0 inset-x-0 bg-opacity-25 bg-black">
      <span on:click|stopPropagation>{lexeme}</span>
      <span class="i-fa-solid-times p-3 cursor-pointer" />
    </div>
    {#if video.storage_path}
      <video
        controls
        autoplay
        playsinline
        src={url_from_storage_path(video.storage_path)}>
        <track kind="captions" />
      </video>
    {:else if video.hosted_elsewhere}
      <VideoThirdParty hosted_video={video.hosted_elsewhere} />
    {/if}
    {#if can_edit}
      <div
        class="p-4 flex justify-between
          items-center absolute bottom-0 inset-x-0 bg-opacity-25 bg-black">
        <Button
          class="ml-auto"
          color="red"
          form="filled"
          onclick={async () => await dbOperations.update_video({ video: { deleted: 'true' }, video_id: video.id })}>
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
