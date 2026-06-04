<script>import Button from "../ui/Button.svelte";
import Badge from "../ui/Badge.svelte";
import DetectUrl from "../functions/DetectUrl.svelte";
export let strings = [], canEdit = false, addMessage = "Add", minimum = 0;
$:
  if (typeof strings === "string") {
    strings = [strings];
  }
import { createEventDispatcher } from "svelte";
const dispatch = createEventDispatcher();
</script>

<div class="sp-8nwa50 {$$props.class}">
  {#if canEdit}
    {#if strings}
      {#each strings as string, index}
        <DetectUrl {string} let:display let:href>
          <Badge
            {href}
            class="sp-rvzs98"
            target="_blank"
            rel="noopener noreferrer"
            onclick={() => dispatch('itemclicked', { value: string, index })}
            onx={strings.length > minimum
              ? () => dispatch('itemremoved', { value: string, index })
              : null}
          >
            {display}
          </Badge>
          <div class="sp-vx1uno" />
        </DetectUrl>
      {/each}
    {/if}
    <slot name="add">
      <Button class="sp-rvzs98" onclick={() => dispatch('additem')} color="orange" size="sm">
        <span class="sp-sc2s0v" />
        {addMessage}
      </Button>
    </slot>
  {:else if strings}
    {#each strings as string}
      <DetectUrl {string} let:display let:href>
        <Badge class="sp-rvzs98" {href} target="_blank" rel="noopener noreferrer">
          {display}
        </Badge>
        <div class="sp-vx1uno" />
      </DetectUrl>
    {/each}
  {/if}
</div>

<style>:global(.sp-sc2s0v){--un-icon:url("data:image/svg+xml;utf8,%3Csvg viewBox='0 0 448 512' display='inline-block' vertical-align='middle' width='1em' height='1em' xmlns='http://www.w3.org/2000/svg' %3E%3Cpath fill='currentColor' d='M416 208H272V64c0-17.67-14.33-32-32-32h-32c-17.67 0-32 14.33-32 32v144H32c-17.67 0-32 14.33-32 32v32c0 17.67 14.33 32 32 32h144v144c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32V304h144c17.67 0 32-14.33 32-32v-32c0-17.67-14.33-32-32-32'/%3E%3C/svg%3E");-webkit-mask:var(--un-icon) no-repeat;mask:var(--un-icon) no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%;background-color:currentColor;color:inherit;display:inline-block;vertical-align:middle;width:1em;height:1em;}:global(.sp-rvzs98){margin-bottom:0.25rem;}:global(.sp-vx1uno){width:0.25rem;}:global(.sp-8nwa50){display:flex;flex-wrap:wrap;}</style>