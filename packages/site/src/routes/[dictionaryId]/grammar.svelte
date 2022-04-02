<script context="module" lang="ts">
  import { setOnline, getDocument } from '$sveltefirets';
  import type { IGrammar } from '@ld/types';

  import type { Load } from '@sveltejs/kit';
  export const load: Load = async ({ page: { params } }) => {
    const dictionaryId = params.dictionaryId;
    try {
      const grammarDoc = await getDocument<IGrammar>(`dictionaries/${dictionaryId}/info/grammar`);
      if (grammarDoc && grammarDoc.grammar) {
        return { props: { grammar: grammarDoc.grammar, dictionaryId } };
      } else return { props: { grammar: null, dictionaryId } };
    } catch (err) {
      return { props: { grammar: null, dictionaryId } };
    }
  };
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { dictionary, isManager } from '$lib/stores';

  export let grammar = '',
    dictionaryId: string;
  import Button from 'svelte-pieces/ui/Button.svelte';

  async function save() {
    try {
      await setOnline<IGrammar>(`dictionaries/${dictionaryId}/info/grammar`, { grammar });
      window.location.replace(`/${dictionaryId}/grammar`);
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
      <div class="max-w-screen-md prose prose-lg">
        {#await import('$lib/components/editor/ClassicCustomized.svelte') then { default: ClassicCustomized }}
          <ClassicCustomized bind:html={grammar} />
        {/await}
      </div>
    {/if}
    <div class="prose prose-lg max-w-screen-md {editing && 'hidden md:block mt-14 ml-3'}">
      {#if grammar}
        {@html grammar}
      {:else}
        <i>{$_('dictionary.no_info_yet', { default: 'No information yet' })}</i>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(.grammar img) {
    max-width: 100%;
  }

  :global(.grammar figure) {
    margin: 0;
  }
</style>
