<script lang="ts">
  import { t } from 'svelte-i18n';
  import type { IEntry, ExpandedVideo } from '@living-dictionaries/types';
  import { ShowHide } from 'svelte-pieces';
  import { firebaseConfig } from 'sveltefirets';

  export let entry: IEntry;
  export let video: ExpandedVideo;
  export let canEdit = false;
</script>

<ShowHide let:show let:toggle>
  <div
    class="{$$props.class} hover:bg-gray-200 flex flex-col items-center
    justify-center cursor-pointer p-3 select-none"
    on:click={toggle}>
    <i class="far fa-film-alt fa-lg mt-1" />
    <div class="text-gray-600 text-sm mt-1">
      {$t('video.view', { default: 'View' })}
    </div>
  </div>
  {#if show}
    {#await import('$lib/components/video/PlayVideo.svelte') then { default: PlayVideo }}
      <PlayVideo
        {entry}
        {video}
        storageBucket={firebaseConfig.storageBucket}
        {canEdit}
        on:deleteVideo
        on:close={toggle} />
    {/await}
  {/if}
</ShowHide>
