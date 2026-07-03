<script lang="ts">
  import type { LiveDb } from '$lib/db/client/live/live-db.svelte'
  import type { Recipient } from './recipient-input.svelte'
  import IconMdiChevronDown from '~icons/mdi/chevron-down'
  import IconMdiChevronUp from '~icons/mdi/chevron-up'
  import RecipientInput from './recipient-input.svelte'

  interface Props {
    db: LiveDb | null | undefined
    cc_recipients: Recipient[]
    bcc_recipients: Recipient[]
    disabled?: boolean
    /** How many emails the Cc/Bcc ride along on. When >1 a note explains the
     *  Cc/Bcc people are copied on every send. 0/1 hides the note. */
    send_count?: number
  }

  let {
    db,
    cc_recipients = $bindable([]),
    bcc_recipients = $bindable([]),
    disabled = false,
    send_count = 1,
  }: Props = $props()

  // Auto-open when there's already content (e.g. a draft restored Cc/Bcc).
  let show = $state(cc_recipients.length > 0 || bcc_recipients.length > 0)
  const has_cc_bcc = $derived(cc_recipients.length > 0 || bcc_recipients.length > 0)
</script>

<div class="cc-bcc">
  <button
    type="button"
    class="cc-toggle"
    onclick={() => { show = !show }}
    aria-expanded={show}>
    Cc / Bcc
    {#if show}
      <IconMdiChevronUp />
    {:else}
      <IconMdiChevronDown />
    {/if}
  </button>

  {#if show}
    <RecipientInput {db} bind:recipients={cc_recipients} label="Cc" id="cc-recipients" placeholder="Add Cc…" {disabled} />
    <RecipientInput {db} bind:recipients={bcc_recipients} label="Bcc" id="bcc-recipients" placeholder="Add Bcc…" {disabled} />
    {#if send_count > 1 && has_cc_bcc}
      <p class="multi-help">
        Heads up: these Cc/Bcc people are copied on every one of the {send_count} emails.
      </p>
    {/if}
  {/if}
</div>

<style>
  .cc-bcc {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .cc-toggle {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0;
    border: 0;
    background: transparent;
    font-size: 0.75rem;
    color: var(--primary);
    cursor: pointer;
  }
  .cc-toggle:hover {
    text-decoration: underline;
  }
  .multi-help {
    margin: 0;
    padding-left: 3.25rem;
    font-size: 0.6875rem;
    color: var(--color-secondary);
  }
</style>
