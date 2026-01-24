<script lang="ts">
  interface Props {
    display: string;
    value: string | string[];
  }

  let { display, value }: Props = $props();
</script>

{#if value?.length > 0}
  <div class="mb-5">
    <div class="text-sm font-medium text-gray-700">
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
