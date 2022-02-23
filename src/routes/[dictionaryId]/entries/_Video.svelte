<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IEntry, IVideo } from '$lib/interfaces';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import { firebaseConfig } from '$sveltefirets';
  export let entry: IEntry, video: IVideo;
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
      <a
        href={`https://firebasestorage.googleapis.com/v0/b/${
          firebaseConfig.storageBucket
        }/o/${video.path.replace(/\//g, '%2F')}?alt=media`}
        target="_blank"
        class="pointer">Open in new tab</a>
    {/if}
  </div>
</ShowHide>
