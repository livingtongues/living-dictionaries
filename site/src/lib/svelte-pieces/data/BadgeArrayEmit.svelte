<script>
  import Button from '../ui/Button.svelte'
  import Badge from '../ui/Badge.svelte'
  import DetectUrl from '../functions/DetectUrl.svelte'

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

<div class="sp-8nwa50 {klass}">
  {#if canEdit}
    {#each list as string, index (index)}
      <DetectUrl {string}>
        {#snippet children({ display, href })}
          <Badge
            {href}
            class="sp-rvzs98"
            target="_blank"
            onclick={() => on_itemclicked?.({ value: string, index })}
            onx={list.length > minimum
              ? () => on_itemremoved?.({ value: string, index })
              : null}>
            {display}
          </Badge>
          <div class="sp-vx1uno"></div>
        {/snippet}
      </DetectUrl>
    {/each}
    {#if add}
      {@render add()}
    {:else}
      <Button class="sp-rvzs98" onclick={() => on_additem?.()} color="orange" size="sm">
        <span class="sp-sc2s0v"></span>
        {addMessage}
      </Button>
    {/if}
  {:else}
    {#each list as string, index (index)}
      <DetectUrl {string}>
        {#snippet children({ display, href })}
          <Badge class="sp-rvzs98" {href} target="_blank">
            {display}
          </Badge>
          <div class="sp-vx1uno"></div>
        {/snippet}
      </DetectUrl>
    {/each}
  {/if}
</div>

<style>:global(.sp-sc2s0v){--un-icon:url("data:image/svg+xml;utf8,%3Csvg viewBox='0 0 448 512' display='inline-block' vertical-align='middle' width='1em' height='1em' xmlns='http://www.w3.org/2000/svg' %3E%3Cpath fill='currentColor' d='M416 208H272V64c0-17.67-14.33-32-32-32h-32c-17.67 0-32 14.33-32 32v144H32c-17.67 0-32 14.33-32 32v32c0 17.67 14.33 32 32 32h144v144c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32V304h144c17.67 0 32-14.33 32-32v-32c0-17.67-14.33-32-32-32'/%3E%3C/svg%3E");-webkit-mask:var(--un-icon) no-repeat;mask:var(--un-icon) no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%;background-color:currentColor;color:inherit;display:inline-block;vertical-align:middle;width:1em;height:1em;}:global(.sp-rvzs98){margin-bottom:0.25rem;}:global(.sp-vx1uno){width:0.25rem;}:global(.sp-8nwa50){display:flex;flex-wrap:wrap;}</style>
