<script lang="ts">
  import { Button } from '$lib/svelte-pieces'
  import sanitize from 'xss'
  import { page } from '$app/stores'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'

  let { data } = $props();
  let { is_manager, dictionary, update_grammar, dictionary_info } = $derived(data)
  let updated = $state('')

  let editing = $state(false)
</script>

<div class="grammar">
  <h3 class="text-xl font-semibold mb-3">
    {$page.data.t('dictionary.grammar')}
  </h3>

  {#if $is_manager}
    {#if editing}
      <Button class="mb-2" onclick={() => (editing = false)}>{$page.data.t('misc.cancel')}</Button>
      <Button
        class="mb-2"
        form="filled"
        onclick={async () => {
          await update_grammar(updated)
          editing = false
        }}>{$page.data.t('misc.save')}</Button>
    {:else}
      <Button class="mb-2" onclick={() => (editing = true)}>{$page.data.t('misc.edit')}</Button>
    {/if}
  {/if}

  <div class="flex">
    {#if editing}
      <div class="max-w-screen-md tw-prose prose-lg">
        {#await import('$lib/components/editor/ClassicCustomized.svelte') then { default: ClassicCustomized }}
          <ClassicCustomized html={$dictionary_info.grammar} on_update={(detail) => (updated = detail)} />
        {/await}
      </div>
    {/if}
    <div class="tw-prose prose-lg max-w-screen-md {editing && 'hidden md:block mt-14 ml-3'}">
      {#if updated || $dictionary_info.grammar}
        {@html sanitize(updated || $dictionary_info.grammar)}
      {:else}
        <i>{$page.data.t('dictionary.no_info_yet')}</i>
      {/if}
    </div>
  </div>
</div>

<SeoMetaTags
  norobots={!dictionary.public}
  title={$page.data.t('dictionary.grammar')}
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
</style>
