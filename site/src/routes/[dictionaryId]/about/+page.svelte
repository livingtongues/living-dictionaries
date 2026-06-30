<script lang="ts">
  import sanitize from 'xss'
  import UserGuide from './UserGuide.svelte'
  import { HeadlessButton } from '$lib/svelte-pieces'
  import { page } from '$app/state'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'

  const { data } = $props()
  const { is_manager, is_contributor, dictionary, update_about, auth_user } = $derived(data)
  let updated = $state('')

  let editing = $state(false)
</script>

<div class="about">
  <h3 class="about-heading">
    {page.data.t('header.about')}
  </h3>

  {#if is_manager}
    <div class="actions">
      {#if editing}
        <button type="button" class="btn btn-default" onclick={() => (editing = false)}>{page.data.t('misc.cancel')}</button>
        <HeadlessButton
          class="btn-primary btn-default"
          onclick={async () => {
            await update_about(updated)
            editing = false
          }}>{page.data.t('misc.save')}</HeadlessButton>
      {:else}
        <button type="button" class="btn btn-default" onclick={() => (editing = true)}>{page.data.t('misc.edit')}</button>
      {/if}
    </div>
  {/if}

  {#if is_manager || is_contributor || auth_user.admin_level > 1}
    <UserGuide />
  {/if}
  <div style="display: flex">
    {#if editing}
      <div class="tw-prose" style="max-width: 768px">
        {#await import('$lib/components/editor/ClassicCustomized.svelte') then { default: ClassicCustomized }}
          <ClassicCustomized html={dictionary.about} on:update={({ detail }) => (updated = detail)} />
        {/await}
      </div>
    {/if}
    <div class="tw-prose about-content" class:editing>
      {#if updated || dictionary.about}
        {@html sanitize(updated || dictionary.about)}
      {:else}
        <i>{page.data.t('dictionary.no_info_yet')}</i>
      {/if}
    </div>
  </div>
</div>

<SeoMetaTags
  norobots={!dictionary.public}
  title={page.data.t('header.about')}
  dictionaryName={dictionary.name}
  description="Learn about the background and creation of this Living Dictionary."
  keywords="About this dictionary, background, creation, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary" />

<style>
  .about-heading {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .about-content {
    max-width: 768px;
  }

  .about-content.editing {
    display: none;
    margin-top: 3.5rem;
    margin-left: 0.75rem;
  }

  @media (min-width: 768px) {
    .about-content.editing {
      display: block;
    }
  }

  :global(.about img) {
    max-width: 100%;
  }

  :global(.about figure) {
    margin: 0;
  }
</style>
