<script lang="ts">
  import Button from 'svelte-pieces/ui/Button.svelte';
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;
  export let action = () => {};
  export let wrap = false,
    attribute: string,
    display: string;
</script>

{#if wrap}
  <form class="mt-4" on:submit|preventDefault={action}>
    <label for={attribute} class="block text-xs leading-5 text-gray-700 mb-1">
      {display}
    </label>
    <div class="flex flex-grow rounded-md shadow-sm">
      <slot />
      <Button type="submit" form="filled">
        {t ? $t('misc.save') : 'Save'}
      </Button>
    </div>
  </form>
{:else}
  <slot />
{/if}