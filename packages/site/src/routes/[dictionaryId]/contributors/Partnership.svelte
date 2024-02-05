<script lang="ts">
  import { page } from '$app/stores';
  import { admin } from '$lib/stores';
  import { add, deleteDocumentOnline, Collection } from 'sveltefirets';
  import { Button } from 'svelte-pieces';
  import type { IPartnership, IDictionary } from '@living-dictionaries/types';
  // import Image from '$lib/components/image/Image.svelte';

  export let dictionary: IDictionary;
  let partnershipType: IPartnership[];

  function writeIn() {
    const name = prompt(`${$page.data.t('speakers.name')}?`);
    if (name)
      add(`dictionaries/${dictionary.id}/partnerships`, { name });
  }
</script>

<h3 class="font-semibold text-lg mb-1 mt-3">
  Partnerships<!-- {$page.data.t('')} -->
</h3>

<Collection
  path={`dictionaries/${dictionary.id}/partnerships`}
  startWith={partnershipType}
  let:data={partnerships}>
  {#each partnerships as partner}
    <div class="py-3 flex flex-wrap items-center">
      <div class="text-sm leading-5 font-medium text-gray-900">
        {partner.name}
      </div>
      {#if $admin}
        <div class="w-1" />
        <Button
          color="red"
          size="sm"
          onclick={() => {
            if (confirm($page.data.t('misc.delete') + '?')) {
              deleteDocumentOnline(
                `dictionaries/${dictionary.id}/partnerships/${partner.id}`
              );
            }
          }}>{$page.data.t('misc.delete')}
          <i class="fas fa-times" /></Button>
      {/if}
    </div>
  {/each}
</Collection>
<!-- {#if partner.logo}
    <Image
      canEdit
      height={300}
      title="{partner.name} Featured Image"
      gcs={dictionary.featuredImage.specifiable_image_url}
      on:deleteImage={async () => await updateDictionary({ featuredImage: null })} />
  {:else}
    <ImageDropZone let:file class="p-3 rounded">
      <span slot="label">{$page.data.t('misc.upload')}</span>
      {#if file}
        {#await import('$lib/components/image/UploadImage.svelte') then { default: UploadImage }}
          <div class="flex flex-col min-h-100px">
            <UploadImage
              {file}
              fileLocationPrefix={`${dictionary.id}/featured_images/`}
              on:uploaded={async ({detail: {fb_storage_path, specifiable_image_url}}) => await updateDictionary({
                featuredImage: {
                  fb_storage_path,
                  specifiable_image_url,
                  uid_added_by: $user.uid,
                  timestamp: new Date(),
                }
              })} />
          </div>
        {/await}
      {/if}
    </ImageDropZone>
  {/if} -->
<Button onclick={writeIn} form="filled">
  <i class="far fa-pencil" />
  Write in Partner<!-- {$page.data.t('')} -->
</Button>

