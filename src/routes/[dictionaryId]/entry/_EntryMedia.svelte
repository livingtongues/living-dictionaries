<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IEntry } from '$lib/interfaces';
  import Audio from '../entries/_Audio.svelte';
  import AddImage from '../entries/_AddImage.svelte';
  import Image from '$lib/components/image/Image.svelte';

  export let entry: IEntry,
    canEdit = false;
</script>

{#if entry.pf}
  <div class="w-full overflow-hidden rounded relative mb-2" style="height: 25vh;">
    <Image width={400} {entry} {canEdit} />
  </div>
{:else if canEdit}
  <AddImage {entry} class="rounded-md h-20 bg-gray-100 mb-2">
    <div class="text-xs" slot="text">
      {$_('entry.upload_photo', { default: 'Upload Photo' })}
    </div>
  </AddImage>
{/if}

{#if entry.sf || canEdit}
  <Audio {entry} class="h-20 mb-2 rounded-md bg-gray-100 px-3" />
{/if}
