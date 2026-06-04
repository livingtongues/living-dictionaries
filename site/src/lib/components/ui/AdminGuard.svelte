<script lang="ts">
  import { page } from '$app/stores'

  interface Props {
    children?: import('svelte').Snippet
  }

  const { children }: Props = $props()
  const { admin } = $derived($page.data)
</script>

{#if $admin}
  {@render children?.()}
{:else}
  <div class="p-3">Not logged in as admin.</div>
{/if}
