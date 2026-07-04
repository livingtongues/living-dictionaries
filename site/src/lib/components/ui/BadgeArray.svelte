<script>
  import IconFaSolidPlus from '~icons/fa-solid/plus'
  import Button from './Button.svelte'
  import Badge from './Badge.svelte'
  import DetectUrl from './DetectUrl.svelte'

  let {
    strings = [],
    canEdit = false,
    promptMessage = undefined,
    addMessage = undefined,
    class: klass = '',
    on_valueupdated = undefined,
    add = undefined,
  } = $props()

  const list = $derived(typeof strings === 'string' ? [strings] : (strings || []))

  function addItem() {
    const string = prompt(promptMessage)
    if (!string)
      return
    on_valueupdated?.([...list, string.trim()])
  }
  function removeAt(index) {
    const next = [...list]
    next.splice(index, 1)
    on_valueupdated?.(next)
  }
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
            onx={() => removeAt(index)}>
            {display}
          </Badge>
          <div class="badge-gap"></div>
        {/snippet}
      </DetectUrl>
    {/each}
    {#if add}
      {@render add({ add: addItem })}
    {:else}
      <Button
        class="badge-item"
        onclick={addItem}
        color="orange"
        size="sm">
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
