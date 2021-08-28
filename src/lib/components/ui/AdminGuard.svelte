<script lang="ts">
  import { admin } from '$lib/stores';
</script>

{#if $admin}
  <slot />
{:else}
  <div class="p-3">Not logged in as admin.</div>
{/if}
