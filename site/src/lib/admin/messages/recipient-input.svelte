<script lang="ts" module>
  /** A recipient pill — a linked user (`user_id` set) or a free-form email. */
  export interface Recipient {
    user_id: string | null
    email: string
    name: string | null
  }
</script>

<script lang="ts">
  import type { LiveDb } from '$lib/db/client/live/live-db.svelte'
  import IconMdiClose from '~icons/mdi/close'
  import { score_record } from '$lib/utils/fuzzy-score'
  import { looks_like_email } from '$lib/utils/parse-email-list'

  interface UserCandidate {
    id: string
    name: string | null
    email: string | null
    aliases: string[]
  }

  interface Props {
    db: LiveDb | null | undefined
    recipients: Recipient[]
    label: string
    id: string
    placeholder?: string
    disabled?: boolean
  }

  let {
    db,
    recipients = $bindable([]),
    label,
    id,
    placeholder = 'Start typing a name or email…',
    disabled = false,
  }: Props = $props()

  let text = $state('')
  let highlight = $state(0)
  let focused = $state(false)
  let input_el = $state<HTMLInputElement>()

  const users_query = $derived(db?.users.query({ limit: 9999 }))
  const aliases_query = $derived(db?.email_aliases.query({ limit: 9999 }))

  const aliases_by_user = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const map = new Map<string, string[]>()
    for (const alias of aliases_query?.rows ?? []) {
      const list = map.get(alias.user_id) ?? []
      list.push(alias.email)
      map.set(alias.user_id, list)
    }
    return map
  })

  const users: UserCandidate[] = $derived(
    (users_query?.rows ?? []).map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      aliases: aliases_by_user.get(user.id) ?? [],
    })),
  )

  const added_emails = $derived(new Set(recipients.map(recipient => recipient.email.toLowerCase())))

  const suggestions = $derived.by(() => {
    const query = text.trim()
    if (!query)
      return []
    const out: { user: UserCandidate, score: number }[] = []
    for (const user of users) {
      if (user.email && added_emails.has(user.email.toLowerCase()))
        continue
      const score = score_record(query, [
        { value: user.name ?? '', weight: 1 },
        { value: user.email ?? '', weight: 1 },
        ...user.aliases.map(alias => ({ value: alias, weight: 0.9 })),
      ])
      if (score > 0)
        out.push({ user, score })
    }
    out.sort((left, right) => right.score - left.score)
    return out.slice(0, 8)
  })

  const active = $derived(Math.min(highlight, Math.max(suggestions.length - 1, 0)))
  const show_dropdown = $derived(focused && suggestions.length > 0)

  function add_user(user: UserCandidate): void {
    if (!user.email || added_emails.has(user.email.toLowerCase())) {
      reset_text()
      return
    }
    recipients.push({ user_id: user.id, email: user.email, name: user.name })
    reset_text()
  }

  /** Commit the typed text as an email pill (linking to a user when it matches). */
  function commit_email(raw: string): boolean {
    const typed = raw.trim().toLowerCase()
    if (!looks_like_email(typed))
      return false
    const matched = users.find(user =>
      user.email?.toLowerCase() === typed
        || user.aliases.some(alias => alias.toLowerCase() === typed))
    const store_email = (matched?.email ?? typed).toLowerCase()
    if (!added_emails.has(store_email)) {
      recipients.push(matched?.email
        ? { user_id: matched.id, email: matched.email, name: matched.name }
        : { user_id: null, email: typed, name: null })
    }
    reset_text()
    return true
  }

  function reset_text(): void {
    text = ''
    highlight = 0
  }

  function remove(index: number): void {
    recipients.splice(index, 1)
  }

  function on_keydown(event: KeyboardEvent): void {
    if (disabled)
      return
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault()
      highlight = Math.min(active + 1, suggestions.length - 1)
      return
    }
    if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault()
      highlight = Math.max(active - 1, 0)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      // A complete email wins outright (commit_email links it to a user if known);
      // otherwise pick the highlighted user suggestion.
      if (looks_like_email(text.trim()))
        commit_email(text)
      else if (suggestions.length)
        add_user(suggestions[active].user)
      return
    }
    if ((event.key === ' ' || event.key === ',') && commit_email(text)) {
      // Space/comma only turns into a pill when the text is a valid email — so
      // multi-word name searches (e.g. "John Smith") keep their spaces.
      event.preventDefault()
      return
    }
    if (event.key === ',' && text.trim()) {
      // Swallow stray commas so they never end up inside the field.
      event.preventDefault()
      return
    }
    if (event.key === 'Backspace' && !text && recipients.length) {
      event.preventDefault()
      recipients.pop()
    }
  }

  function on_blur(): void {
    focused = false
    commit_email(text)
  }
</script>

<div class="recipient-field" class:disabled>
  <label class="field-label" for={id}>{label}</label>
  <div class="control">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="pill-box" onclick={() => input_el?.focus()}>
      {#each recipients as recipient, index (recipient.email + index)}
        <span class="pill" class:linked={recipient.user_id}>
          <span class="pill-text">{recipient.name || recipient.email}</span>
          {#if recipient.name}
            <span class="pill-email">{recipient.email}</span>
          {/if}
          <button
            type="button"
            class="pill-x"
            aria-label={`Remove ${recipient.email}`}
            {disabled}
            onclick={(event) => { event.stopPropagation(); remove(index) }}>
            <IconMdiClose />
          </button>
        </span>
      {/each}
      <input
        bind:this={input_el}
        {id}
        type="text"
        class="pill-input"
        bind:value={text}
        placeholder={recipients.length ? '' : placeholder}
        autocomplete="off"
        spellcheck="false"
        {disabled}
        onkeydown={on_keydown}
        onfocus={() => { focused = true }}
        onblur={on_blur} />
    </div>

    {#if show_dropdown}
      <ul class="suggestions">
        {#each suggestions as { user }, index (user.id)}
          <li>
            <button
              type="button"
              class="suggestion-btn"
              class:active={index === active}
              onmousedown={event => event.preventDefault()}
              onclick={() => add_user(user)}>
              <span class="suggestion-name">{user.name || '(no name)'}</span>
              <span class="suggestion-email">{user.email || '(no email)'}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else if focused && text.trim() && !looks_like_email(text.trim())}
      <p class="hint">No users match — type a full email to add it.</p>
    {/if}
  </div>
</div>

<style>
  .recipient-field {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    font-size: 0.75rem;
  }
  .field-label {
    width: 2.5rem;
    flex-shrink: 0;
    padding-top: 0.5rem;
    color: var(--color-secondary);
  }
  .control {
    position: relative;
    flex: 1;
    min-width: 0;
  }
  .pill-box {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    min-height: 2.25rem;
    padding: 0.3125rem 0.5rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
    background: var(--background);
    cursor: text;
  }
  .pill-box:focus-within {
    border-color: var(--primary);
  }
  .recipient-field.disabled .pill-box {
    opacity: 0.5;
  }
  .pill {
    display: inline-flex;
    align-items: baseline;
    gap: 0.3125rem;
    max-width: 100%;
    padding: 0.1875rem 0.25rem 0.1875rem 0.5rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--primary) 10%, var(--background));
    border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--border-color));
    font-size: 0.8125rem;
    line-height: 1.2;
  }
  .pill-text {
    color: var(--color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pill-email {
    color: var(--color-secondary);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pill-x {
    align-self: center;
    display: inline-flex;
    padding: 0.0625rem;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
  }
  .pill-x:hover {
    background: color-mix(in srgb, var(--danger) 15%, transparent);
    color: var(--danger);
  }
  .pill-input {
    flex: 1;
    min-width: 8rem;
    border: 0;
    padding: 0.1875rem 0.125rem;
    background: transparent;
    color: var(--color);
    font: inherit;
    font-size: 0.8125rem;
  }
  .pill-input:focus {
    outline: none;
  }
  .suggestions {
    position: absolute;
    z-index: 20;
    left: 0;
    right: 0;
    top: calc(100% + 0.25rem);
    list-style: none;
    padding: 0;
    margin: 0;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--background);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    overflow: hidden;
  }
  .suggestion-btn {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.125rem;
    padding: 0.5rem 0.75rem;
    border: 0;
    background: var(--background);
    text-align: left;
    cursor: pointer;
  }
  .suggestion-btn:hover,
  .suggestion-btn.active {
    background: var(--surface);
  }
  .suggestion-name {
    font-size: 0.8125rem;
    color: var(--color);
  }
  .suggestion-email {
    font-size: 0.75rem;
    color: var(--color-secondary);
    font-family: var(--font-mono);
  }
  .hint {
    margin: 0.25rem 0 0;
    font-size: 0.6875rem;
    color: var(--color-secondary);
  }
</style>
