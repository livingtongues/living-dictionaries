<script lang="ts">
  import { t } from 'svelte-i18n';
  import type { ExpandedVideo } from '@living-dictionaries/types';
  import { ShowHide } from 'svelte-pieces';
  import { firebaseConfig } from 'sveltefirets';

  export let lexeme: string;
  export let video: ExpandedVideo;
  export let canEdit = false;
</script>

<ShowHide let:show let:toggle>
  <div
    class="{$$props.class} hover:bg-gray-200 flex flex-col items-center
      justify-center cursor-pointer select-none text-gray-800"
    on:click={toggle}>
    <span class="i-bi-camera-video text-xl mt-1" />
    <div class="text-sm">
      {$t('video.view', { default: 'View' })}
    </div>
  </div>
  {#if show}
    {#await import('$lib/components/video/PlayVideo.svelte') then { default: PlayVideo }}
      <PlayVideo
        {lexeme}
        {video}
        storageBucket={firebaseConfig.storageBucket}
        {canEdit}
        on:deleteVideo
        on:close={toggle} />
    {/await}
  {/if}
</ShowHide>
