<script>
  import IconFaSolidPlus from '~icons/fa-solid/plus'
  import Button from './Button.svelte'
  import Badge from './Badge.svelte'
  import DetectUrl from './DetectUrl.svelte'

  let {
    strings = [],
    canEdit = false,
    addMessage = 'Add',
    minimum = 0,
    class: klass = '',
    on_itemclicked = undefined,
    on_itemremoved = undefined,
    on_additem = undefined,
    add = undefined,
  } = $props()

  const list = $derived(typeof strings === 'string' ? [strings] : (strings || []))
</script>

<div class="badges {klass}">
  {#if canEdit}
    {#each list as string, index (index)}
      <DetectUrl {string}>
        {#snippet children({ display, href })}
          <Badge
            {href}
            class="badge-item"
            target="_blank"
            onclick={() => on_itemclicked?.({ value: string, index })}
            onx={list.length > minimum
              ? () => on_itemremoved?.({ value: string, index })
              : null}>
            {display}
          </Badge>
          <div class="badge-gap"></div>
        {/snippet}
      </DetectUrl>
    {/each}
    {#if add}
      {@render add()}
    {:else}
      <Button class="badge-item" onclick={() => on_additem?.()} color="orange" size="sm">
        <IconFaSolidPlus class="icon-inline" />
        {addMessage}
      </Button>
    {/if}
  {:else}
    {#each list as string, index (index)}
      <DetectUrl {string}>
        {#snippet children({ display, href })}
          <Badge class="badge-item" {href} target="_blank">
            {display}
          </Badge>
          <div class="badge-gap"></div>
        {/snippet}
      </DetectUrl>
    {/each}
  {/if}
</div>

<style>
  .badges {
    display: flex;
    flex-wrap: wrap;
  }

  /* applied to child Badge/Button components */
  :global(.badge-item) {
    margin-bottom: 0.25rem;
  }

  .badge-gap {
    width: 0.25rem;
  }
</style>
