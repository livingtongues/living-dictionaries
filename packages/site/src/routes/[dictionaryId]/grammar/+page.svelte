<script lang="ts">
  import { t } from 'svelte-i18n';
  import { setOnline } from 'sveltefirets';
  import { Button } from 'svelte-pieces';
  import type { IGrammar } from '@living-dictionaries/types';
  import sanitize from 'xss';
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';

  export let data;
  $: ({ isManager } = data)
  let updated = '';

  async function save() {
    try {
      await setOnline<IGrammar>(`dictionaries/${data.dictionary.id}/info/grammar`, { grammar: updated });
      window.location.replace(`/${data.dictionary.id}/grammar`);
    } catch (err) {
      alert(err);
    }
  }

  let editing = false;
</script>

<div class="grammar">
  <h3 class="text-xl font-semibold mb-3">
    {$t('dictionary.grammar', { default: 'Grammar' })}
  </h3>

  {#if $isManager}
    {#if editing}
      <Button class="mb-2" onclick={() => (editing = false)}
      >{$t('misc.cancel', { default: 'Cancel' })}</Button>
      <Button class="mb-2" form="filled" onclick={save}
      >{$t('misc.save', { default: 'Save' })}</Button>
    {:else}
      <Button class="mb-2" onclick={() => (editing = true)}
      >{$t('misc.edit', { default: 'Edit' })}</Button>
    {/if}
  {/if}

  <div class="flex">
    {#if editing}
      <div class="max-w-screen-md tw-prose prose-lg">
        {#await import('$lib/components/editor/ClassicCustomized.svelte') then { default: ClassicCustomized }}
          <ClassicCustomized html={data.grammar} on:update={({ detail }) => (updated = detail)} />
        {/await}
      </div>
    {/if}
    <div class="tw-prose prose-lg max-w-screen-md {editing && 'hidden md:block mt-14 ml-3'}">
      {#if updated || data.grammar}
        {@html sanitize(updated || data.grammar)}
      {:else}
        <i>{$t('dictionary.no_info_yet', { default: 'No information yet' })}</i>
      {/if}
    </div>
  </div>
</div>

<SeoMetaTags
  title={$t('dictionary.grammar', { default: 'Grammar' })}
  dictionaryName={data.dictionary.name}
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
