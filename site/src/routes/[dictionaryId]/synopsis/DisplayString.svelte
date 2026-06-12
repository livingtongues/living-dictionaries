<script lang="ts">
  interface Props {
    display: string
    value: string | string[]
  }

  const { display, value }: Props = $props()
</script>

{#if value?.length > 0}
  <div style="margin-bottom: 1.25rem">
    <div class="section-label">
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

<style>
  .section-label {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
  }
</style>
