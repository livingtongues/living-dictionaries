<script lang="ts">
  import { t } from 'svelte-i18n';
  import AddImage from '$lib/components/image/AddImage.svelte';

  export let gcsPath: string;
  export let dictionayName: string;
</script>

{#if gcsPath}
  <div class="text-sm font-medium text-gray-700 mb-2">
    {$t('', { default: 'Featured Image' })}
  </div>
  <div class="bg-gray-300 w-14 h-14">
    <img class="object-cover w-full h-full" alt="Featured image of {dictionayName}" src="https://lh3.googleusercontent.com/{gcsPath}=w36" />
  </div>
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