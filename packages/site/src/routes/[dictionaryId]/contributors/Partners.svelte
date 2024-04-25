<script lang="ts">
  import { Button } from 'svelte-pieces'
  import type { Partner } from '@living-dictionaries/types'
  import type { Readable } from 'svelte/store'
  import { page } from '$app/stores'
  import Image from '$lib/components/image/Image.svelte'
  import AddImage from '$lib/components/image/AddImage.svelte'

  export let admin = 0
  export let can_edit = false
  export let partners: Partner[]
  export let add_partner_name: (name: string) => Promise<void>
  export let delete_partner: (partner_id: string) => Promise<void>
  export let add_partner_image: (partner_id: string, file: File) => Readable<{ progress: number, error?: string, preview_url: string }>
  export let delete_partner_image: ({ partner_id, fb_storage_path }: { partner_id: string, fb_storage_path: string }) => Promise<void>
  export let hide_living_tongues_logo: (allow: boolean) => Promise<void>
  export let hideLivingTonguesLogo = false

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
        <div class="w-1" />
        <Button
          color="red"
          size="sm"
          onclick={async () => {
            await hide_living_tongues_logo(true)
          }}>{$page.data.t('misc.delete')}
          <i class="fas fa-times" /></Button>
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
        <div class="w-1" />
        <Button
          color="red"
          size="sm"
          onclick={async () => {
            if (confirm(`${$page.data.t('misc.delete')}?`))
              await delete_partner(partner.id)
          }}>{$page.data.t('misc.delete')}
          <i class="fas fa-times" /></Button>
      {/if}
    </div>
    {#if partner.logo}
      <div class="max-w-400px">
        <Image
          {can_edit}
          width={400}
          title="{partner.name} Logo"
          gcs={partner.logo.specifiable_image_url}
          on_delete_image={() => delete_partner_image({ fb_storage_path: partner.logo.fb_storage_path, partner_id: partner.id })} />
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
      <i class="far fa-pencil" />
      {$page.data.t('partnership.button')}
    </Button>
  {/if}
</div>
