<script lang="ts">
  import { Button } from '$lib/svelte-pieces'
  import sanitize from 'xss'
  import UserGuide from './UserGuide.svelte'
  import { page } from '$app/state'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'

  let { data } = $props();
  let { is_manager, is_contributor, dictionary, update_about, dictionary_info, admin } = $derived(data)
  let updated = $state('')

  let editing = $state(false)
</script>

<div class="about">
  <h3 class="text-xl font-semibold mb-3">
    {page.data.t('header.about')}
  </h3>

  {#if $is_manager}
    {#if editing}
      <Button class="mb-2" onclick={() => (editing = false)}>{page.data.t('misc.cancel')}</Button>
      <Button
        class="mb-2"
        form="filled"
        onclick={async () => {
          await update_about(updated)
          editing = false
        }}>{page.data.t('misc.save')}</Button>
    {:else}
      <Button class="mb-2" onclick={() => (editing = true)}>{page.data.t('misc.edit')}</Button>
    {/if}
  {/if}

  {#if $is_manager || $is_contributor || $admin > 1}
    <UserGuide />
  {/if}
  <div class="flex">
    {#if editing}
      <div class="max-w-screen-md tw-prose prose-lg">
        {#await import('$lib/components/editor/ClassicCustomized.svelte') then { default: ClassicCustomized }}
          <ClassicCustomized html={$dictionary_info.about} on_update={(detail) => (updated = detail)} />
        {/await}
      </div>
    {/if}
    <div class="tw-prose prose-lg max-w-screen-md {editing && 'hidden md:block mt-14 ml-3'}">
      {#if updated || $dictionary_info.about}
        {@html sanitize(updated || $dictionary_info.about)}
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
  :global(.about img) {
    max-width: 100%;
  }

  :global(.about figure) {
    margin: 0;
  }
</style>
