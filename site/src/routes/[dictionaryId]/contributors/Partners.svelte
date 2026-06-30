<script lang="ts">
  import type { Readable } from 'svelte/store'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiPencilOutline from '~icons/mdi/pencil-outline'
  import type { PartnerWithPhoto } from '$lib/types'
  import { HeadlessButton } from '$lib/svelte-pieces'
  import { page } from '$app/state'
  import Image from '$lib/components/image/Image.svelte'
  import AddImage from '$lib/components/image/AddImage.svelte'

  interface Props {
    admin?: number
    can_edit?: boolean
    partners: PartnerWithPhoto[]
    add_partner_name: (name: string) => Promise<void>
    delete_partner: (partner_id: string) => Promise<void>
    add_partner_image: (partner_id: string, file: File) => Readable<{ progress: number, error?: string, preview_url: string }>
    delete_partner_image: ({ partner_id, photo_id }: { partner_id: string, photo_id: string }) => Promise<void>
    hide_living_tongues_logo: (allow: boolean) => Promise<void>
    hideLivingTonguesLogo?: boolean
  }

  const {
    admin = 0,
    can_edit = false,
    partners,
    add_partner_name,
    delete_partner,
    add_partner_image,
    delete_partner_image,
    hide_living_tongues_logo,
    hideLivingTonguesLogo = false,
  }: Props = $props()

  const LIVING_TONGUES_LOGO
    = 'https://firebasestorage.googleapis.com/v0/b/talking-dictionaries-alpha.appspot.com/o/livingdictionary%2Fimages%2FLiving_Tongues_Logo_transparent%20300dpi.png?alt=media'

  async function ask_partner_name() {
    const name = prompt(page.data.t('partnership.name'))?.trim()
    if (name)
      await add_partner_name(name)
  }
</script>

<h3 class="section-heading">
  {page.data.t('partnership.title')}
</h3>

<div>
  {#if !hideLivingTonguesLogo}
    <div class="partner-row">
      <div class="partner-name">
        Living Tongues Institute for Endangered Languages
      </div>
      {#if admin}
        <div style="flex-grow: 1"></div>
        <HeadlessButton
          class="btn-ghost btn-sm delete-button"
          style="gap: 0.25rem"
          onclick={async () => {
            await hide_living_tongues_logo(true)
          }}>{page.data.t('misc.delete')}
          <IconMdiClose /></HeadlessButton>
      {/if}
    </div>
    <div style="max-width: 400px">
      <img
        style="height: 100%; width: 100%; object-fit: cover"
        alt="Living Tongues Institute for Endangered Languages"
        src={LIVING_TONGUES_LOGO} />
    </div>
  {:else if admin}
    <button
      type="button"
      class="btn btn-default"
      onclick={async () => {
        await hide_living_tongues_logo(false)
      }}>Show Living Tongues Logo</button>
  {/if}
  {#each partners as partner (partner.id)}
    <div class="partner-row">
      <div class="partner-name">
        {partner.name}
      </div>
      {#if can_edit}
        <div style="flex-grow: 1"></div>
        <HeadlessButton
          class="btn-ghost btn-sm delete-button"
          style="gap: 0.25rem"
          onclick={async () => {
            if (confirm(`${page.data.t('misc.delete')}?`)) {
              if (partner.photo) {
                await delete_partner_image({ photo_id: partner.photo.id, partner_id: partner.id })
              }
              await delete_partner(partner.id)
            }
          }}>{page.data.t('misc.delete')}
          <IconMdiClose /></HeadlessButton>
      {/if}
    </div>
    {#if partner.photo}
      <div style="max-width: 400px">
        <Image
          {can_edit}
          width={400}
          title="{partner.name} Logo"
          gcs={partner.photo.serving_url}
          on_delete_image={() => delete_partner_image({ photo_id: partner.photo.id, partner_id: partner.id })} />
      </div>
    {:else}
      {#if can_edit}
        <div class="add-logo-tile">
          <AddImage border upload_image={file => add_partner_image(partner.id, file)} />
        </div>
      {/if}
    {/if}
  {/each}
  {#if can_edit}
    <HeadlessButton class="btn-primary btn-default add-partner-button" onclick={ask_partner_name} style="gap: 0.4rem">
      <IconMdiPencilOutline />
      {page.data.t('partnership.button')}
    </HeadlessButton>
  {/if}
</div>

<style>
  .section-heading {
    font-weight: 600;
    font-size: 1.125rem;
    line-height: 1.75rem;
    margin-bottom: 0.25rem;
    margin-top: 0.75rem;
  }

  :global(.delete-button) {
    color: var(--danger);
  }

  .partner-row {
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }

  .partner-name {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: var(--color); /* ≈ gray-900 */
  }

  .add-logo-tile {
    max-width: 400px;
    height: 100px;
    display: flex;
    flex-direction: column;
  }

  .add-logo-tile:hover {
    background-color: var(--surface); /* ≈ gray-100 */
  }

  div :global(.add-partner-button) {
    margin-top: 0.5rem;
  }
</style>
