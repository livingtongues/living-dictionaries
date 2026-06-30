<script lang="ts">
  import type { EntryData } from '$lib/types'
  import { ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/state'
  import IconBiCameraVideo from '~icons/bi/camera-video'

  interface Props {
    lexeme: string
    video: EntryData['senses'][0]['videos'][0]
    can_edit?: boolean
    class?: string
  }

  const { lexeme, video, can_edit = false, class: klass = '' }: Props = $props()
</script>

<ShowHide>
  {#snippet children({ show, toggle })}
    <div
      class="{klass} video-action"
      onclick={toggle}>
      <IconBiCameraVideo class="icon-inline" style="font-size: 1.25rem; margin-top: 0.25rem" />
      <div class="view-label">
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
  {/snippet}
</ShowHide>

<style>
  .video-action {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
    color: var(--color); /* ≈ gray-800 */
  }

  .video-action:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
  }

  .view-label {
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
</style>
