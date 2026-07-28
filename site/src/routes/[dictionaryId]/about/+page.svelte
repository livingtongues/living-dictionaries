<script lang="ts">
  import UserGuide from './UserGuide.svelte'
  import GuidanceList from './GuidanceList.svelte'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import { page } from '$app/state'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { about_has_meaningful_content } from '$lib/markdown/about-content'
  import { render_markdown_to_html } from '$lib/markdown/render'
  import { sanitize_rich_text as sanitize } from '$lib/markdown/sanitize-rich-text'
  import IconFa6SolidPencil from '~icons/fa6-solid/pencil'
  import IconMdiLightbulbOnOutline from '~icons/mdi/lightbulb-on-outline'

  const { data } = $props()
  const { is_manager, is_contributor, dictionary, update_about, auth_user } = $derived(data)
  let updated = $state('')

  let editing = $state(false)
  let show_guidance_modal = $state(false)

  const can_see_guidance = $derived(is_manager || is_contributor || auth_user.admin_level >= 3)

  function start_editing() {
    updated = dictionary.about || ''
    editing = true
  }
</script>

<div class="about">
  <div class="header-row">
    <h3 class="about-heading">
      {page.data.t('header.about')}
    </h3>

    {#if is_manager}
      {#if editing}
        <button type="button" class="btn btn-default" onclick={() => (editing = false)}>{page.data.t('misc.cancel')}</button>
        <HeadlessButton
          class="btn-primary btn-default"
          onclick={async () => {
            await update_about(updated)
            editing = false
          }}>{page.data.t('misc.save')}</HeadlessButton>
      {:else}
        <button type="button" class="btn btn-default" onclick={start_editing}>
          <IconFa6SolidPencil /> {page.data.t('misc.edit')}
        </button>
      {/if}
    {/if}

    {#if can_see_guidance && !editing}
      <button type="button" class="btn btn-default" onclick={() => show_guidance_modal = true}>
        <IconMdiLightbulbOnOutline /> {page.data.t('misc.guidance')}
      </button>
    {/if}
  </div>

  {#if editing}
    <UserGuide />
  {/if}

  <div class="body-row" class:editing>
    {#if editing}
      <div class="editor-column">
        {#await import('$lib/markdown/MarkdownEditor.svelte') then { default: MarkdownEditor }}
          <MarkdownEditor bind:value={updated} />
        {/await}
      </div>
    {/if}
    <div class="tw-prose about-content" class:editing>
      {#if updated}
        {@html sanitize(render_markdown_to_html(updated))}
      {:else if dictionary.about}
        {@html sanitize(render_markdown_to_html(dictionary.about))}
      {:else}
        <i>{page.data.t('dictionary.no_info_yet')}</i>
      {/if}
    </div>
  </div>
</div>

{#if show_guidance_modal}
  <Modal on_close={() => show_guidance_modal = false}>
    {#snippet heading()}
      {page.data.t('misc.guidance')}
    {/snippet}
    <GuidanceList />
  </Modal>
{/if}

<SeoMetaTags
  norobots={!dictionary.public || !about_has_meaningful_content(dictionary.about)}
  title={page.data.t('header.about')}
  dictionaryName={dictionary.name}
  description="Learn about the background and creation of this Living Dictionary."
  keywords="About this dictionary, background, creation, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary" />

<style>
  .header-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .about-heading {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    margin-right: 0.25rem;
  }

  .header-row .btn {
    gap: 0.375rem;
  }

  .body-row {
    display: flex;
  }

  .body-row.editing {
    gap: 0.75rem;
  }

  .editor-column {
    flex: 1;
    min-width: 0;
  }

  .about-content {
    flex: 1;
    min-width: 0;
  }

  .about-content.editing {
    display: none;
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
