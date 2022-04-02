<script context="module" lang="ts">
  import { getDocument } from '$sveltefirets';

  import type { Load } from '@sveltejs/kit';
  export const load: Load = async ({ params }) => {
    const dictionaryId = params.dictionaryId;
    try {
      const aboutDoc = await getDocument<IAbout>(`dictionaries/${dictionaryId}/info/about`);
      if (aboutDoc && aboutDoc.about) {
        return { props: { about: aboutDoc.about, dictionaryId } };
      } else return { props: { about: null, dictionaryId } };
    } catch (err) {
      return { props: { aboutDoc: null, dictionaryId } };
    }
  };
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { dictionary, isManager } from '$lib/stores';

  export let about = '',
    dictionaryId: string;
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { setOnline } from '$sveltefirets';
  import type { IAbout } from '@ld/types';

  async function save() {
    try {
      await setOnline<IAbout>(`dictionaries/${dictionaryId}/info/about`, { about });
      window.location.replace(`/${dictionaryId}/about`);
    } catch (err) {
      alert(err);
    }
  }

  let editing = false;
</script>

<svelte:head>
  <title>
    {$dictionary.name}
    {$_('header.about', { default: 'About' })}
  </title>
</svelte:head>

<div class="about">
  <h3 class="text-xl font-semibold mb-3">
    {$_('header.about', { default: 'About' })}
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
          <ClassicCustomized bind:html={about} />
        {/await}
      </div>
    {/if}
    <div class="prose prose-lg max-w-screen-md {editing && 'hidden md:block mt-14 ml-3'}">
      {#if about}
        {@html about}
      {:else}
        <i>{$_('dictionary.no_info_yet', { default: 'No information yet' })}</i>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(.about img) {
    max-width: 100%;
  }

  :global(.about figure) {
    margin: 0;
  }
</style>
