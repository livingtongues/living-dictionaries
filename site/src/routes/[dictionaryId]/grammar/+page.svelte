<script lang="ts">
  import sanitize from 'xss'
  import { HeadlessButton } from '$lib/svelte-pieces'
  import { page } from '$app/state'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'

  const { data } = $props()
  const { is_manager, dictionary, update_grammar } = $derived(data)
  let updated = $state('')

  let editing = $state(false)
</script>

<div class="grammar">
  <h3 class="grammar-heading">
    {page.data.t('dictionary.grammar')}
  </h3>

  {#if is_manager}
    <div class="actions">
      {#if editing}
        <button type="button" class="btn btn-default" onclick={() => (editing = false)}>{page.data.t('misc.cancel')}</button>
        <HeadlessButton
          class="btn-primary btn-default"
          onclick={async () => {
            await update_grammar(updated)
            editing = false
          }}>{page.data.t('misc.save')}</HeadlessButton>
      {:else}
        <button type="button" class="btn btn-default" onclick={() => (editing = true)}>{page.data.t('misc.edit')}</button>
      {/if}
    </div>
  {/if}

  <div style="display: flex">
    {#if editing}
      <div class="tw-prose" style="max-width: 768px">
        {#await import('$lib/components/editor/ClassicCustomized.svelte') then { default: ClassicCustomized }}
          <ClassicCustomized html={dictionary.grammar} on:update={({ detail }) => (updated = detail)} />
        {/await}
      </div>
    {/if}
    <div class="tw-prose grammar-content" class:editing>
      {#if updated || dictionary.grammar}
        {@html sanitize(updated || dictionary.grammar)}
      {:else}
        <i>{page.data.t('dictionary.no_info_yet')}</i>
      {/if}
    </div>
  </div>
</div>

<SeoMetaTags
  norobots={!dictionary.public}
  title={page.data.t('dictionary.grammar')}
  dictionaryName={dictionary.name}
  description="Learn about the grammar of the language in this Living Dictionary."
  keywords="Grammar of a language, grammatical, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Bibliography" />

<style>
  :global(.grammar img) {
    max-width: 100%;
  }

  :global(.grammar figure) {
    margin: 0;
  }

  .grammar-heading {
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

  .grammar-content {
    max-width: 768px;
  }

  .grammar-content.editing {
    display: none;
    margin-top: 3.5rem;
    margin-left: 0.75rem;
  }

  @media (min-width: 768px) {
    .grammar-content.editing {
      display: block;
    }
  }
</style>
