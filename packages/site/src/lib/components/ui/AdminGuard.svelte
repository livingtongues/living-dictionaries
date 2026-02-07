<script lang="ts">
  import { browser } from '$app/environment'
  import { page } from '$app/state'

  interface Props {
    children?: import('svelte').Snippet
  }

  let { children }: Props = $props()
  let { admin } = $derived(page.data)
</script>

{#if $admin}
  {#if browser}
    {@render children?.()}
  {/if}
{:else}
  <div class="p-3">Not logged in as admin.</div>
{/if}
