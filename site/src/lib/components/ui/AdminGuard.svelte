<script lang="ts">
  import { page } from '$app/stores'

  interface Props {
    children?: import('svelte').Snippet
  }

  const { children }: Props = $props()
  const { auth_user } = $derived($page.data)
</script>

{#if auth_user.is_admin}
  {@render children?.()}
{:else}
  <div class="p-3">Not logged in as admin.</div>
{/if}
