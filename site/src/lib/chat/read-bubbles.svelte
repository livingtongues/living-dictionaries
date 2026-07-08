<script lang="ts">
  import { color_for_user, initials } from './read-receipts'

  interface Member {
    user_id: string
    name: string
  }

  interface Props {
    members: Member[]
    /** Max avatars before collapsing to a "+N" chip. */
    max?: number
  }
  let { members, max = 4 }: Props = $props()

  const shown = $derived(members.slice(0, max))
  const overflow = $derived(Math.max(0, members.length - max))
  const title = $derived(`Seen by ${members.map(member => member.name).join(', ')}`)
</script>

{#if members.length}
  <div class="bubbles" {title}>
    {#each shown as member (member.user_id)}
      <span class="bubble" style:background={color_for_user(member.user_id)}>{initials(member.name)}</span>
    {/each}
    {#if overflow}
      <span class="bubble more">+{overflow}</span>
    {/if}
  </div>
{/if}

<style>
  .bubbles {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 0 0.5rem 0.1rem 0;
    margin-top: -0.05rem;
  }
  .bubble {
    width: 1.05rem;
    height: 1.05rem;
    border-radius: 50%;
    color: #fff;
    font-size: 0.55rem;
    font-weight: 700;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid var(--background);
    flex-shrink: 0;
  }
  .bubble:not(:first-child) {
    margin-left: -0.35rem;
  }
  .bubble.more {
    background: var(--color-secondary);
    font-size: 0.5rem;
  }
</style>
