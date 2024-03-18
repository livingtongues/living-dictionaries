<script lang="ts">
  import { page } from '$app/stores';
</script>

{#if $page.data.useradmin}
  <slot />
{:else}
  <div class="p-3">Not logged in as admin.</div>
{/if}
