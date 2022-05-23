<script lang="ts">
  import { _ } from 'svelte-i18n';
  export let value: string,
    display: string,
    canEdit = false;
</script>

{#if value || canEdit}
  <div class="md:mx-1 md:px-1 rounded" class:order-2={!value}>
    <div class="text-xs text-gray-500 mt-1">{display}</div>
    <div class="border-b-2 border-dashed pb-1 mb-2">
      {#if canEdit}
        <div class="hover:bg-gray-100 -mx-1 relative">
          {#await import('$lib/components/table/cells/SelectPOS.svelte') then SelectPOS}
            <SelectPOS.default {canEdit} {value} on:valueupdate />
          {/await}
          {#if !value}
            <div class="pointer-events-none px-1 absolute w-full top-0">
              <i class="far fa-pencil text-gray-500 text-sm" />
            </div>
          {/if}
        </div>
      {:else}{$_('ps.' + value, { default: value })}{/if}
    </div>
  </div>
{/if}
