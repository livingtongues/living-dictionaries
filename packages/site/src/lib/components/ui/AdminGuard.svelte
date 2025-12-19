<script lang="ts">
  import { page } from '$app/stores';
  interface Props {
    children?: import('svelte').Snippet;
  }

  let { children }: Props = $props();
  let { admin } = $derived($page.data);
</script>

{#if $admin}
  {@render children?.()}
{:else}
  <div class="p-3">Not logged in as admin.</div>
{/if}
