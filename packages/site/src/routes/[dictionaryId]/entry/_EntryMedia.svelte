<script lang="ts">
  import { t } from 'svelte-i18n';
  import type { IEntry } from '@living-dictionaries/types';
  import Audio from '../entries/_Audio.svelte';
  import AddImage from '../entries/_AddImage.svelte';
  import { Image } from '@living-dictionaries/parts';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import Video from '../entries/_Video.svelte';
  import { deleteImage } from '$lib/helpers/delete';

  export let entry: IEntry,
    videoAccess = false,
    canEdit = false;
</script>

{#if entry.vfs && entry.vfs[0]}
  <div class="w-full overflow-hidden rounded relative mb-2">
    <Video class="bg-gray-100 border-r-2" {entry} video={entry.vfs[0]} {canEdit} />
  </div>
{:else if videoAccess && canEdit}
  <ShowHide let:show let:toggle>
    <button type="button"
      class="rounded bg-gray-100 border-r-2 hover:bg-gray-300 flex flex-col items-center
        justify-center cursor-pointer p-6"
      on:click={toggle}>
      <i class="far fa-video-plus my-1 mx-2" />
      <span class="text-xs">
        {$t('video.add_video', { default: 'Add Video' })}
      </span>
    </button>
    {#if show}
      {#await import('$lib/components/video/AddVideo.svelte') then { default: AddVideo }}
        <AddVideo {entry} on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>
{/if}

{#if entry.pf}
  <div class="w-full overflow-hidden rounded relative mb-2" style="height: 25vh;">
    <Image
      {t}
      width={400}
      lexeme={entry.lx}
      gcs={entry.pf.gcs}
      {canEdit}
      on:delete={() => deleteImage(entry)} />
  </div>
{:else if canEdit}
  <AddImage {entry} class="rounded-md h-20 bg-gray-100 mb-2">
    <div class="text-xs" slot="text">
      {$t('entry.upload_photo', { default: 'Upload Photo' })}
    </div>
  </AddImage>
{/if}

{#if entry.sf || canEdit}
  <Audio {entry} class="h-20 mb-2 rounded-md bg-gray-100 !px-3" />
{/if}
