<script lang="ts">
  import { page } from '$app/stores';
  import { add, updateOnline, deleteDocumentOnline, Collection } from 'sveltefirets';
  import { Button } from 'svelte-pieces';
  import type { IPartnership, IDictionary } from '@living-dictionaries/types';
  import Image from '$lib/components/image/Image.svelte';
  import ImageDropZone from '$lib/components/image/ImageDropZone.svelte';

  export let dictionary: IDictionary;
  export let isContributor = false;
  let showLivingTonguesLogo = true;
  let partnershipType: IPartnership[];
  const DEFAULT_IMAGE =
    'https://firebasestorage.googleapis.com/v0/b/talking-dictionaries-alpha.appspot.com/o/livingdictionary%2Fimages%2FNEW_Living_Tongues_logo_with_white_around_it.png?alt=media&token=dceda3c5-85c4-4cec-9f9e-885047653524';

  function writeIn() {
    const name = prompt(`Partner Organization Name`);
    if (name)
      add(`dictionaries/${dictionary.id}/partnerships`, { name });
  }

  async function updatePartner(change: Partial<IPartnership>, partner_id: string) {
    try {
      await updateOnline<IPartnership>(`dictionaries/${dictionary.id}/partnerships/${partner_id}`, change)
    } catch (err) {
      alert(`${$page.data.t('misc.error')}: ${err}`);
    }
  }
</script>

<h3 class="font-semibold text-lg mb-1 mt-3">
  Partner Organizations<!-- {$page.data.t('')} -->
</h3>

<div>
  <div class:hidden={!showLivingTonguesLogo}>
    <div class="py-3 flex flex-wrap items-center">
      <div class="text-sm leading-5 font-medium text-gray-900">
        Living Tongues Institute for Endangered Languages
      </div>
      {#if isContributor}
        <div class="w-1" />
        <Button
          color="red"
          size="sm"
          onclick={() => {
            showLivingTonguesLogo = false;
          }}>{$page.data.t('misc.delete')}
          <i class="fas fa-times" /></Button>
      {/if}
    </div>
    <div class="max-w-[400px]">
      <img
        class="h-full w-full object-cover"
        alt=""
        src={DEFAULT_IMAGE} />
    </div>
  </div>
  <Collection
    path={`dictionaries/${dictionary.id}/partnerships`}
    startWith={partnershipType}
    let:data={partnerships}>
    {#each partnerships as partner}
      <div class="py-3 flex flex-wrap items-center">
        <div class="text-sm leading-5 font-medium text-gray-900">
          {partner.name}
        </div>
        {#if isContributor}
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
      {#if partner.logo}
        <div class="max-w-[400px]">
          <Image
            canEdit
            width={400}
            title="{partner.name} Logo"
            gcs={partner.logo.specifiable_image_url}
            on:deleteImage={async () => await updatePartner({ logo: null }, partner.id)} />
        </div>
      {:else}
        {#if isContributor}
          <ImageDropZone let:file class="p-3 rounded max-w-[400px]">
            <span slot="label">{$page.data.t('misc.upload')}</span>
            {#if file}
              {#await import('$lib/components/image/UploadImage.svelte') then { default: UploadImage }}
                <div class="flex flex-col min-h-100px">
                  <UploadImage
                    {file}
                    fileLocationPrefix={`${dictionary.id}/partnerships/${partner.id}/logo/`}
                    on:uploaded={async ({detail: {fb_storage_path, specifiable_image_url}}) => await updatePartner({
                      logo: {
                        fb_storage_path,
                        specifiable_image_url,
                        uid_added_by: 'test',
                        timestamp: new Date(),
                      }
                    }, partner.id)} />
                </div>
              {/await}
            {/if}
          </ImageDropZone>
        {/if}
      {/if}
    {/each}
  </Collection>
  {#if isContributor}
    <Button class="mt-2" onclick={writeIn} form="filled">
      <i class="far fa-pencil" />
      Write in Partner Organization<!-- {$page.data.t('')} -->
    </Button>
  {/if}
</div>

