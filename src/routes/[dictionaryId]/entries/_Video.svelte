<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { canEdit } from '$lib/stores';
  import type { IEntry } from '$lib/interfaces';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  export let entry: IEntry,
    minimal = false;
</script>

<ShowHide let:show let:toggle>
  {#if entry.vf}
    <div
      class="{$$props.class} hover:bg-gray-200 flex flex-col items-center
    justify-center cursor-pointer p-3 select-none"
      on:click={toggle}>
      <i class="far fa-film-alt fa-lg mt-1" />
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
      on:click={toggle}>
      <i class="far fa-video-plus my-1 mx-2 text-blue-800" />
      {#if !minimal}
        <div class="text-blue-800 text-xs">{$_('video.add_video', { default: 'Add Video' })}</div>
      {/if}
    </div>
  {/if}

  {#if show}
    <!-- {#await import('$lib/components/video/ViewVideo.svelte') then { default: ViewVideo }}
      <ViewVideo {entry} on:close={toggle} />
    {/await} -->
  {/if}
</ShowHide>
