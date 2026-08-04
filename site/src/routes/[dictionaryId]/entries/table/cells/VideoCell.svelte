<script lang="ts">
  import type { EntryData } from '$lib/types'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { video_thumb_src } from '$lib/utils/media-url'
  import { page } from '$app/state'
  import IconBiCameraVideo from '~icons/bi/camera-video'
  import IconMdiPlay from '~icons/mdi/play'

  interface Props {
    entry: EntryData
    sense: EntryData['senses'][0] | null
    can_edit?: boolean
    title?: string
  }

  const { entry, sense, can_edit = false, title = '' }: Props = $props()

  const first_video = $derived(sense?.videos?.[0])
  const thumb_url = $derived(first_video ? video_thumb_src(first_video) : null)
  let thumb_errored = $state(false)

  $effect(() => {
    void first_video
    thumb_errored = false
  })

  const video_disabled = $derived(!!page.data.dictionary?.con_language_description)
</script>

{#if first_video}
  <ShowHide>
    {#snippet children({ show, toggle })}
      <button
        type="button"
        class="video-thumb"
        title={page.data.t('video.view')}
        onclick={toggle}>
        {#if thumb_url && !thumb_errored}
          <img src={thumb_url} alt="" onerror={() => thumb_errored = true} />
          <span class="play-overlay"><IconMdiPlay style="font-size: 1rem" /></span>
        {:else}
          <IconBiCameraVideo style="font-size: 1.125rem" />
        {/if}
      </button>
      {#if show}
        {#await import('$lib/components/video/PlayVideo.svelte') then { default: PlayVideo }}
          <PlayVideo
            lexeme={title}
            video={first_video}
            {can_edit}
            on_close={toggle} />
        {/await}
      {/if}
    {/snippet}
  </ShowHide>
{:else if can_edit && sense?.id && !video_disabled}
  <ShowHide>
    {#snippet children({ show, toggle })}
      <button
        type="button"
        class="add-video empty-affordance"
        title={page.data.t('video.add_video')}
        onclick={toggle}>
        <IconBiCameraVideo style="font-size: 1.125rem" />
      </button>
      {#if show}
        {#await import('$lib/components/video/AddVideo.svelte') then { default: AddVideo }}
          <AddVideo {entry} sense_id={sense.id} context="table" on_close={toggle} />
        {/await}
      {/if}
    {/snippet}
  </ShowHide>
{/if}

<style>
  .video-thumb {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border: none;
    padding: 0;
    overflow: hidden;
    background: color-mix(in srgb, var(--color) 8%, transparent);
    color: var(--color-secondary);
    cursor: pointer;
  }

  .video-thumb img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .play-overlay {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.375rem;
    height: 1.375rem;
    border-radius: 50%;
    background: rgb(0 0 0 / 0.55);
    color: #fff;
    pointer-events: none;
  }

  .add-video {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    color: color-mix(in srgb, var(--color) 75%, var(--background));
    cursor: pointer;
  }
</style>
