<script>import { createEventDispatcher } from "svelte";
import Button from "../ui/Button.svelte";
import Badge from "../ui/Badge.svelte";
import DetectUrl from "../functions/DetectUrl.svelte";
export let strings = [];
export let canEdit = false;
export let promptMessage;
export let addMessage;
$:
  if (typeof strings === "string") {
    strings = [strings];
  }
const dispatch = createEventDispatcher();
function add() {
  const string = prompt(promptMessage);
  if (!string)
    return;
  strings = [...strings || [], string.trim()];
  dispatch("valueupdated", strings);
}
</script>

<div class="sp-7m9ebd {$$props.class}">
  {#if canEdit}
    {#if strings}
      {#each strings as string, i}
        <DetectUrl {string} let:display let:href>
          <Badge
            {href}
            class="sp-zzrqc1"
            target="_blank"
            rel="noopener noreferrer"
            onx={() => {
              strings.splice(i, 1)
              strings = strings
              dispatch('valueupdated', strings)
            }}>
            {display}
          </Badge>
          <div class="sp-snu3dl" />
        </DetectUrl>
      {/each}
    {/if}
    <slot name="add" {add}>
      <Button
        class="sp-zzrqc1"
        onclick={add}
        color="orange"
        size="sm">
        <span class="sp-bznewy" />
        {addMessage}
      </Button>
    </slot>
  {:else if strings}
    {#each strings as string}
      <DetectUrl {string} let:display let:href>
        <Badge class="sp-zzrqc1" {href} target="_blank" rel="noopener noreferrer">
          {display}
        </Badge>
        <div class="sp-snu3dl" />
      </DetectUrl>
    {/each}
  {/if}
</div>

<style>:global(.sp-bznewy){--un-icon:url("data:image/svg+xml;utf8,%3Csvg viewBox='0 0 448 512' display='inline-block' vertical-align='middle' width='1em' height='1em' xmlns='http://www.w3.org/2000/svg' %3E%3Cpath fill='currentColor' d='M416 208H272V64c0-17.67-14.33-32-32-32h-32c-17.67 0-32 14.33-32 32v144H32c-17.67 0-32 14.33-32 32v32c0 17.67 14.33 32 32 32h144v144c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32V304h144c17.67 0 32-14.33 32-32v-32c0-17.67-14.33-32-32-32'/%3E%3C/svg%3E");-webkit-mask:var(--un-icon) no-repeat;mask:var(--un-icon) no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%;background-color:currentColor;color:inherit;display:inline-block;vertical-align:middle;width:1em;height:1em;}:global(.sp-zzrqc1){margin-bottom:0.25rem;}:global(.sp-snu3dl){width:0.25rem;}:global(.sp-7m9ebd){display:flex;flex-wrap:wrap;}</style>