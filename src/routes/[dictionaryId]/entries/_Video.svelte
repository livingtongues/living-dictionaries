<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { canEdit } from '$lib/stores';
  import { longpress } from '$svelteui/actions/longpress';
  import type { IEntry } from '$lib/interfaces';
  export let entry: IEntry,
    minimal = false;

  let playing = false;
  function initVideo() {
    playing = true;
    setTimeout(() => {
      playing = false;
    }, 2000);
  }

  let openVideoModal = false;
</script>

{#if entry.vf}
  <div
    class="{$$props.class} hover:bg-gray-200 flex flex-col items-center
    justify-center cursor-pointer p-3 select-none"
    use:longpress={800}
    on:click={() => {
      /* if ($canEdit) {
        openVideoModal = true;
      } else {
        initVideo(); //initVideo(entry.sf);
      } */
      openVideoModal = true;
    }}
    on:longpress={() => initVideo()}>
    {#if playing}
      <i class="fas fa-film-alt fa-lg mt-1" />
    {:else}<i class="far fa-film-alt fa-lg mt-1" />{/if}
    <div class="text-gray-600 text-sm mt-1">
      {$_('video.view', { default: 'View' })}
      {#if !minimal && $canEdit}
        + {$_('video.edit_video', { default: 'Edit Video' })}
      {/if}
    </div>
  </div>
{:else if $canEdit}
  <div
    class="{$$props.class} hover:bg-gray-300 flex flex-col items-center
justify-center cursor-pointer p-2 text-lg"
    on:click={() => (openVideoModal = true)}>
    <i class="far fa-video-plus my-1 mx-2 text-blue-800" />
    {#if !minimal}
      <div class="text-blue-800 text-xs">{$_('video.add_video', { default: 'Add Video' })}</div>
    {/if}
  </div>
{/if}

{#if openVideoModal}
  {#await import('$lib/components/video/ViewVideo.svelte') then ViewVideo}
    <ViewVideo.default
      {entry}
      on:close={() => {
        openVideoModal = null;
      }} />
  {/await}
{/if}
