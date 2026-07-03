<script lang="ts">
  import type { LiveDb } from '$lib/db/client/live/live-db.svelte'
  import type { Recipient } from './recipient-input.svelte'
  import CcBccFields from './cc-bcc-fields.svelte'
  import RecipientInput from './recipient-input.svelte'

  interface Props {
    db: LiveDb | null | undefined
    from_email: string
    from_name: string
    to_recipients: Recipient[]
    cc_recipients: Recipient[]
    bcc_recipients: Recipient[]
    disabled?: boolean
  }

  let {
    db,
    from_email,
    from_name,
    to_recipients = $bindable([]),
    cc_recipients = $bindable([]),
    bcc_recipients = $bindable([]),
    disabled = false,
  }: Props = $props()

  const multiple_to = $derived(to_recipients.length > 1)
</script>

<div class="outbound-fields">
  <div class="field-row">
    <span class="field-label">From</span>
    <span class="field-value">
      {from_name}
      <span class="mono">&lt;{from_email}&gt;</span>
    </span>
  </div>

  <RecipientInput
    {db}
    bind:recipients={to_recipients}
    label="To"
    id="compose-to"
    placeholder="Start typing a name or email…"
    {disabled} />

  {#if multiple_to}
    <p class="multi-help">
      Each of these {to_recipients.length} recipients gets their own separate email and thread — they won't see one another.
    </p>
  {/if}

  <CcBccFields {db} bind:cc_recipients bind:bcc_recipients {disabled} send_count={to_recipients.length} />
</div>

<style>
  .outbound-fields {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .field-row {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    font-size: 0.75rem;
  }
  .field-label {
    width: 2.5rem;
    flex-shrink: 0;
    color: var(--color-secondary);
  }
  .field-value {
    color: var(--color);
    min-width: 0;
  }
  .mono {
    font-family: var(--font-mono);
    color: var(--color-secondary);
  }
  .multi-help {
    margin: 0;
    padding-left: 3.25rem;
    font-size: 0.6875rem;
    color: var(--color-secondary);
  }
</style>
