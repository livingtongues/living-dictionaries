<script lang="ts">
  import sanitize from 'xss'
  import UserGuide from './UserGuide.svelte'
  import { HeadlessButton } from '$lib/svelte-pieces'
  import { page } from '$app/state'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { looks_like_html, rich_text_display_html } from '$lib/markdown/html-era-shim'
  import { render_markdown_to_html } from '$lib/markdown/render'

  const { data } = $props()
  const { is_manager, is_contributor, dictionary, update_about, auth_user } = $derived(data)
  let updated = $state('')

  let editing = $state(false)

  async function start_editing() {
    if (looks_like_html(dictionary.about)) {
      // HTML-era row (pre-cutover): convert on read so the editor gets markdown
      // and a save naturally persists markdown. Client-only (needs a DOM).
      const { html_to_markdown } = await import('$lib/markdown/html-to-markdown')
      updated = html_to_markdown(dictionary.about)
    } else {
      updated = dictionary.about || ''
    }
    editing = true
  }
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
        <button type="button" class="btn btn-default" onclick={start_editing}>{page.data.t('misc.edit')}</button>
      {/if}
    </div>
  {/if}

  {#if is_manager || is_contributor || auth_user.admin_level > 1}
    <UserGuide />
  {/if}
  <div style="display: flex">
    {#if editing}
      <div style="flex: 1; max-width: 768px">
        {#await import('$lib/markdown/MarkdownEditor.svelte') then { default: MarkdownEditor }}
          <MarkdownEditor bind:value={updated} />
        {/await}
      </div>
    {/if}
    <div class="tw-prose about-content" class:editing>
      {#if updated}
        {@html sanitize(render_markdown_to_html(updated))}
      {:else if dictionary.about}
        {@html sanitize(rich_text_display_html(dictionary.about))}
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
