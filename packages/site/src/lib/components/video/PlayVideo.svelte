<script lang="ts">
  import { createBubbler, stopPropagation } from 'svelte/legacy';

  const bubble = createBubbler();
  import type { EntryData } from '@living-dictionaries/types'
  import { Button } from '$lib/svelte-pieces'
  import VideoThirdParty from './VideoThirdParty.svelte'
  import { page } from '$app/stores'

  let { dbOperations, url_from_storage_path } = $derived($page.data)

  interface Props {
    lexeme: string;
    video: EntryData['senses'][0]['videos'][0];
    can_edit?: boolean;
    on_close: () => void;
  }

  let {
    lexeme,
    video,
    can_edit = false,
    on_close
  }: Props = $props();
</script>

<div
  onclick={on_close}
  class="fixed inset-0 md:p-3 flex flex-col items-center justify-center"
  style="background: rgba(0, 0, 0, 0.85); z-index: 51; will-change: transform;">
  <div class="h-full flex flex-col justify-center">
    <div
      class="font-semibold text-white p-4 flex justify-between items-center
        absolute top-0 inset-x-0 bg-opacity-25 bg-black">
      <span onclick={stopPropagation(bubble('click'))}>{lexeme}</span>
      <span class="i-fa-solid-times p-3 cursor-pointer"></span>
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
          onclick={async () => {
            const confirmation = confirm($page.data.t('entry.delete_video'))
            if (confirmation) await dbOperations.update_video({ deleted: new Date().toISOString(), id: video.id })
          }}>
          <span class="i-fa-trash-o" style="margin: -1px 0 2px;"></span>
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
