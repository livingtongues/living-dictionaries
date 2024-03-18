<script lang="ts">
  import { page } from '$app/stores';
  $: ({ admin } = $page.data);
</script>

{#if $admin}
  <slot />
{:else}
  <div class="p-3">Not logged in as admin.</div>
{/if}
