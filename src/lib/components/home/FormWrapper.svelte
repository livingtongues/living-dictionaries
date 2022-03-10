<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Button from '$svelteui/ui/Button.svelte';
  export let action = () => {};
  export let wrap = false;
</script>

{#if wrap}
  <form class="mt-4" on:submit|preventDefault={action}>
    <slot />
    <Button type="submit" form="primary">
      {$_('misc.save', { default: 'Save' })}
    </Button>
  </form>
{:else}
  <slot />
{/if}
