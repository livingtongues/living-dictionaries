<script lang="ts">
  import { page } from '$app/stores';
  import { Button } from 'svelte-pieces';
  import type { Partner } from '@living-dictionaries/types';
  import Image from '$lib/components/image/Image.svelte';
  import ImageDropZone from '$lib/components/image/ImageDropZone.svelte';
  import type { Readable } from 'svelte/store';

  export let admin = 0;
  export let can_edit = false;
  export let partners: Partner[];
  export let add_partner_name: (name: string) => Promise<void>;
  export let delete_partner: (partner_id: string) => Promise<void>;
  export let add_partner_image: (partner_id: string, file: File) => Readable<{ progress: number; error?: string, preview_url: string }>;
  export let delete_partner_image: ({partner_id, fb_storage_path}: {partner_id: string, fb_storage_path: string}) => Promise<void>;

  let showLivingTonguesLogo = true;
  const LIVING_TONGUES_LOGO =
    'https://firebasestorage.googleapis.com/v0/b/talking-dictionaries-alpha.appspot.com/o/livingdictionary%2Fimages%2FLiving_Tongues_Logo_transparent%20300dpi.png?alt=media';

  async function ask_partner_name() {
    const name = prompt($page.data.t('partnership.name'))?.trim();
    if (name)
      await add_partner_name(name);
  }
</script>

<h3 class="font-semibold text-lg mb-1 mt-3">
  {$page.data.t('partnership.title')}
</h3>

<div>
  <div class:hidden={!showLivingTonguesLogo}>
    <div class="py-3 flex flex-wrap items-center">
      <div class="text-sm leading-5 font-medium text-gray-900">
        Living Tongues Institute for Endangered Languages
      </div>
      {#if admin > 1}
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
        src={LIVING_TONGUES_LOGO} />
    </div>
  </div>
  {#each partners as partner}
    <div class="py-3 flex flex-wrap items-center">
      <div class="text-sm leading-5 font-medium text-gray-900">
        {partner.name}
      </div>
      {#if can_edit}
        <div class="w-1" />
        <Button
          color="red"
          size="sm"
          onclick={async () => {
            if (confirm($page.data.t('misc.delete') + '?'))
              await delete_partner(partner.id);
          }}>{$page.data.t('misc.delete')}
          <i class="fas fa-times" /></Button>
      {/if}
    </div>
    {#if partner.logo}
      <div class="max-w-400px">
        <Image
          canEdit={can_edit}
          width={400}
          title="{partner.name} Logo"
          gcs={partner.logo.specifiable_image_url}
          on:deleteImage={() => delete_partner_image({fb_storage_path: partner.logo.fb_storage_path, partner_id: partner.id})} />
      </div>
    {:else}
      {#if can_edit}
        <ImageDropZone class="p-3 rounded max-w-400px" let:file>
          <span slot="label">{$page.data.t('misc.upload')}</span>
          {#if file}
            {@const image_upload_status = add_partner_image(partner.id, file)}
            {#await import('$lib/components/image/UploadImageStatus.svelte') then { default: UploadImageStatus }}
              <div class="flex flex-col min-h-200px max-w-400px">
                <UploadImageStatus {image_upload_status} />
              </div>
            {/await}
          {/if}
        </ImageDropZone>
      {/if}
    {/if}
  {/each}
  {#if can_edit}
    <Button class="mt-2" onclick={ask_partner_name} form="filled">
      <i class="far fa-pencil" />
      {$page.data.t('partnership.button')}
    </Button>
  {/if}
</div>

