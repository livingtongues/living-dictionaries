<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IEntry, IVideo } from '$lib/interfaces';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  export let entry: IEntry,
    video: IVideo,
    canEdit = false;
</script>

<ShowHide let:show let:toggle>
  <div
    class="{$$props.class} hover:bg-gray-200 flex flex-col items-center
    justify-center cursor-pointer p-3 select-none"
    on:click={toggle}>
    <i class="far fa-film-alt fa-lg mt-1" />
    <div class="text-gray-600 text-sm mt-1">
      {$_('video.view', { default: 'View' })}
    </div>
    {#if show}
      {#await import('$lib/components/video/PlayVideo.svelte') then { default: PlayVideo }}
        <PlayVideo {entry} {video} {canEdit} on:close={toggle} />
      {/await}
    {/if}
  </div>
</ShowHide>
