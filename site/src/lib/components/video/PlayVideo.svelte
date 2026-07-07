<script lang="ts">
  import type { EntryData } from '$lib/types'
  import VideoThirdParty from './VideoThirdParty.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import { page } from '$app/state'
  import IconFaSolidTimes from '~icons/fa-solid/times'
  import IconFaTrashO from '~icons/fa/trash-o'

  const { db_operations, url_from_storage_path } = $derived(page.data)

  interface Props {
    lexeme: string
    video: EntryData['senses'][0]['videos'][0]
    can_edit?: boolean
    on_close: () => void
  }

  const {
    lexeme,
    video,
    can_edit = false,
    on_close,
  }: Props = $props()
</script>

<div
  onclick={on_close}
  class="viewer"
  style="background: rgba(0, 0, 0, 0.85); z-index: 51; will-change: transform;">
  <div class="viewer-inner">
    <div class="viewer-header">
      <span onclick={e => e.stopPropagation()}>{lexeme}</span>
      <IconFaSolidTimes class="icon-inline viewer-close" style="font-size: 2.5rem" />
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
      <div class="viewer-footer">
        <Button
          class="video-delete-button"
          color="red"
          form="filled"
          onclick={async () => {
            const confirmation = confirm(page.data.t('entry.delete_video'))
            if (confirmation) await db_operations.delete_video(video.id)
          }}>
          <IconFaTrashO class="icon-inline" style="margin: -1px 0 2px;" />
          {page.data.t('misc.delete')}
        </Button>
      </div>
    {/if}
  </div>
</div>

<style>
  .viewer {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  @media (min-width: 768px) {
    .viewer {
      padding: 0.75rem;
    }
  }

  .viewer-inner {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .viewer-header {
    font-weight: 600;
    color: #fff;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background-color: rgb(0 0 0 / 0.25);
  }

  .viewer-header :global(.viewer-close) {
    cursor: pointer;
  }

  .viewer-footer {
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: rgb(0 0 0 / 0.25);
  }

  .viewer-footer :global(.video-delete-button) {
    margin-left: auto;
  }
</style>

<!-- {#if !video.youtubeId && !video.vimeoId}
        <Button
          href={video.storage_url}
          target="_blank">
          <i class="fas fa-download" />
          <span class="hidden sm:inline"
            >{page.data.t('misc.download', {
              default: 'Download',
            })}</span>
        </Button>
      {/if} -->
