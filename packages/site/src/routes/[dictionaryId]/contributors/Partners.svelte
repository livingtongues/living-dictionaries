<script lang="ts">
  import { Button } from '$lib/svelte-pieces'
  import type { Readable } from 'svelte/store'
  import type { PartnerWithPhoto } from '@living-dictionaries/types'
  import { page } from '$app/stores'
  import Image from '$lib/components/image/Image.svelte'
  import AddImage from '$lib/components/image/AddImage.svelte'

  interface Props {
    admin?: number;
    can_edit?: boolean;
    partners: PartnerWithPhoto[];
    add_partner_name: (name: string) => Promise<void>;
    delete_partner: (partner_id: string) => Promise<void>;
    add_partner_image: (partner_id: string, file: File) => Readable<{ progress: number, error?: string, preview_url: string }>;
    delete_partner_image: ({ partner_id, photo_id }: { partner_id: string, photo_id: string }) => Promise<void>;
    hide_living_tongues_logo: (allow: boolean) => Promise<void>;
    hideLivingTonguesLogo?: boolean;
  }

  let {
    admin = 0,
    can_edit = false,
    partners,
    add_partner_name,
    delete_partner,
    add_partner_image,
    delete_partner_image,
    hide_living_tongues_logo,
    hideLivingTonguesLogo = false
  }: Props = $props();

  const LIVING_TONGUES_LOGO
    = 'https://firebasestorage.googleapis.com/v0/b/talking-dictionaries-alpha.appspot.com/o/livingdictionary%2Fimages%2FLiving_Tongues_Logo_transparent%20300dpi.png?alt=media'

  async function ask_partner_name() {
    const name = prompt($page.data.t('partnership.name'))?.trim()
    if (name)
      await add_partner_name(name)
  }
</script>

<h3 class="font-semibold text-lg mb-1 mt-3">
  {$page.data.t('partnership.title')}
</h3>

<div>
  {#if !hideLivingTonguesLogo}
    <div class="py-3 flex flex-wrap items-center">
      <div class="text-sm leading-5 font-medium text-gray-900">
        Living Tongues Institute for Endangered Languages
      </div>
      {#if admin}
        <div class="w-1"></div>
        <Button
          color="red"
          size="sm"
          onclick={async () => {
            await hide_living_tongues_logo(true)
          }}>{$page.data.t('misc.delete')}
          <i class="fas fa-times"></i></Button>
      {/if}
    </div>
    <div class="max-w-[400px]">
      <img
        class="h-full w-full object-cover"
        alt="Living Tongues Institute for Endangered Languages"
        src={LIVING_TONGUES_LOGO} />
    </div>
  {:else if admin}
    <Button
      onclick={async () => {
        await hide_living_tongues_logo(false)
      }}>Show Living Tongues Logo</Button>
  {/if}
  {#each partners as partner}
    <div class="py-3 flex flex-wrap items-center">
      <div class="text-sm leading-5 font-medium text-gray-900">
        {partner.name}
      </div>
      {#if can_edit}
        <div class="w-1"></div>
        <Button
          color="red"
          size="sm"
          onclick={async () => {
            if (confirm(`${$page.data.t('misc.delete')}?`)) {
              if (partner.photo) {
                await delete_partner_image({ photo_id: partner.photo.id, partner_id: partner.id })
              }
              await delete_partner(partner.id)
            }
          }}>{$page.data.t('misc.delete')}
          <i class="fas fa-times"></i></Button>
      {/if}
    </div>
    {#if partner.photo}
      <div class="max-w-400px">
        <Image
          {can_edit}
          width={400}
          title="{partner.name} Logo"
          gcs={partner.photo.serving_url}
          on_delete_image={() => delete_partner_image({ photo_id: partner.photo.id, partner_id: partner.id })} />
      </div>
    {:else}
      {#if can_edit}
        <div class="max-w-400px hover:bg-gray-100 h-100px flex flex-col">
          <AddImage border upload_image={file => add_partner_image(partner.id, file)} />
        </div>
      {/if}
    {/if}
  {/each}
  {#if can_edit}
    <Button class="mt-2" onclick={ask_partner_name} form="filled">
      <i class="far fa-pencil"></i>
      {$page.data.t('partnership.button')}
    </Button>
  {/if}
</div>
