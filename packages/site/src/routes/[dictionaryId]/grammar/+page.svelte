<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { dictionary, isManager } from '$lib/stores';
  import { setOnline } from 'sveltefirets';
  import type { IGrammar } from '@living-dictionaries/types';
  import sanitize from 'xss';
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';

  import type { PageData } from './$types';
  export let data: PageData;
  let grammar = data.grammar || '';
  import Button from 'svelte-pieces/ui/Button.svelte';

  async function save() {
    try {
      await setOnline<IGrammar>(`dictionaries/${$dictionary.id}/info/grammar`, { grammar });
      window.location.replace(`/${$dictionary.id}/grammar`);
    } catch (err) {
      alert(err);
    }
  }

  let editing = false;
</script>

<svelte:head>
  <title>
    {$dictionary.name}
    {$_('dictionary.grammar', { default: 'Grammar' })}
  </title>
</svelte:head>

<div class="grammar">
  <h3 class="text-xl font-semibold mb-3">
    {$_('dictionary.grammar', { default: 'Grammar' })}
  </h3>

  {#if $isManager}
    {#if editing}
      <Button class="mb-2" onclick={() => (editing = false)}
        >{$_('misc.cancel', { default: 'Cancel' })}</Button>
      <Button class="mb-2" form="filled" onclick={save}
        >{$_('misc.save', { default: 'Save' })}</Button>
    {:else}
      <Button class="mb-2" onclick={() => (editing = true)}
        >{$_('misc.edit', { default: 'Edit' })}</Button>
    {/if}
  {/if}

  <div class="flex">
    {#if editing}
      <div class="max-w-screen-md tw-prose prose-lg">
        {#await import('@living-dictionaries/parts/src/lib/editor/ClassicCustomized.svelte') then { default: ClassicCustomized }}
          <ClassicCustomized bind:html={grammar} />
        {/await}
      </div>
    {/if}
    <div class="tw-prose prose-lg max-w-screen-md {editing && 'hidden md:block mt-14 ml-3'}">
      {#if grammar}
        {@html sanitize(grammar)}
      {:else}
        <i>{$_('dictionary.no_info_yet', { default: 'No information yet' })}</i>
      {/if}
    </div>
  </div>
</div>

<SeoMetaTags
  title={$_('dictionary.grammar', { default: 'Grammar' })}
  dictionaryName={$dictionary.name}
  description={$_('', { default: 'Learn about the grammar of the language in this Living Dictionary.' })}
  keywords="Grammar of a language, grammatical, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Bibliography" />

<style>
  :global(.grammar img) {
    max-width: 100%;
  }

  :global(.grammar figure) {
    margin: 0;
  }
</style>
