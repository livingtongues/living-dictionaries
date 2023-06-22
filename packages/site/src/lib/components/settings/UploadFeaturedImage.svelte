<script lang="ts">
  import { t } from 'svelte-i18n';
  import { createEventDispatcher } from 'svelte';
  import AddImage from '$lib/components/image/AddImage.svelte';
  import { Button } from 'svelte-pieces';

  export let gcsPath: string;
  export let dictionayName: string;

  const dispatch = createEventDispatcher<{
    deleteDictionaryImage: boolean;
  }>();
</script>

{#if gcsPath}
  <div class="text-sm font-medium text-gray-700 mb-2">
    {$t('', { default: 'Featured Image' })}
  </div>
  <div class="bg-gray-300 w-14 h-14">
    <img class="object-cover w-full h-full" alt="Featured image of {dictionayName}" src="https://lh3.googleusercontent.com/{gcsPath}=w36" />
  </div>
  <Button
  class="mt-2"
    color="red"
    form="filled"
    onclick={(e) => {
      e.stopPropagation();
      dispatch('deleteDictionaryImage');
    }}>
    <span class="i-fa-trash-o" style="margin: -1px 0 2px;" />
    {$t('misc.delete', { default: 'Delete' })}
  </Button>
{:else}
  <div class="text-sm font-medium text-gray-700 mb-2">
    {$t('', { default: 'Upload a featured image' })}
  </div>
  <AddImage class="bg-gray-100">
    <div class="text-xs" slot="text">
      {$t('entry.photo', { default: 'Photo' })}
    </div>
  </AddImage>
{/if}