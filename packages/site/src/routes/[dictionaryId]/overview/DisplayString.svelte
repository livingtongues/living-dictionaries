<script lang="ts">
  export let display: string
  export let value: string | string[]
</script>

{#if value?.length > 0}
  <div class="mb-5">
    <div class="text-sm font-medium text-gray-700 mb-2">
      {display}
    </div>
    {#if typeof value === 'string'}
      <p>
        {value}
      </p>
    {:else}
      <p>{value.join(', ')}</p>
    {/if}
  </div>
{/if}
