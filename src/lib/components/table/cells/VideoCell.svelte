<script lang="ts">
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import { longpress } from '$svelteui/actions/longpress';
  import type { IEntry } from '$lib/interfaces';
  export let entry: IEntry,
    canEdit = false;

  let playing;
  function initVideo() {
    playing = true;
    setTimeout(() => {
      playing = false;
    }, 2000);
  }
</script>

<ShowHide let:toggle let:show>
  {#if entry.vf}
    <div
      class="hover:bg-gray-200 flex flex-col items-center justify-center
  cursor-pointer h-full select-none text-sm"
      use:longpress
      on:shortpress={() => {
        if (canEdit) {
          toggle();
        } else {
          initVideo();
        }
      }}
      on:longpress={() => initVideo()}>
      <i class="{playing ? 'fas' : 'far'} fa-film-alt" />
      <!-- change to fa-volume-up -->
    </div>
  {:else if canEdit}
    <div
      class="hover:bg-gray-200 flex flex-col items-center justify-center
  cursor-pointer h-full select-none text-sm"
      on:click={toggle}>
      <i class="far fa-video-plus text-blue-800" />
    </div>
  {/if}
  {#if show}
    {#await import('$lib/components/video/WatchVideo.svelte') then { default: WatchVideo }}
      <WatchVideo {entry} on:close={toggle} />
    {/await}
  {/if}
</ShowHide>
