<script lang="ts">
  import type { EntryData } from '$lib/types'
  import { ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/stores'

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
      class="{klass} hover:bg-gray-200 flex flex-col items-center
        justify-center cursor-pointer select-none text-gray-800"
      onclick={toggle}>
      <span class="i-bi-camera-video text-xl mt-1"></span>
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
  {/snippet}
</ShowHide>
