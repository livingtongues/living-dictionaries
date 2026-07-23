<script lang="ts">
  import { page } from '$app/state'
  import Slideover from '$lib/components/ui/Slideover.svelte'
  import EntryField from '../../entry/[entryId]/EntryField.svelte'
  import { get_orthographies } from '$lib/helpers/orthographies'
  import { order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses'
  import { grammar_sections_editable } from '$lib/corpus/grammar-preview'
  import { DISCOURSE_ROLES } from '$lib/constants'
  import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'
  import IconSystemUiconsTrash from '~icons/system-uicons/trash'

  interface Props {
    sentence: DictRowType<'sentences'>
    can_edit: boolean
    on_close: () => void
    on_deleted: () => void
  }

  const { sentence, can_edit, on_close, on_deleted }: Props = $props()

  const { dictionary } = $derived(page.data)
  const orthographies = $derived(get_orthographies(dictionary ?? {}))
  // Discourse role is a structured-grammar preview field — admin-3 only until the cutover.
  const show_discourse = $derived(grammar_sections_editable({ auth_user: page.data.auth_user }))
  const glossing_languages = $derived(order_entry_and_dictionary_gloss_languages(sentence?.translation, dictionary.gloss_languages))

  // Worker op (not the live-row _save): text changes re-tokenize + re-match in
  // the same transaction, preserving confirmed/gold-IGT tokens.
  async function save(patch: Record<string, unknown>) {
    await page.data.writes.update_sentence({ id: sentence.id, ...patch })
  }

  async function delete_sentence() {
    if (!confirm(`${page.data.t('sentence.delete')}?`)) return
    await sentence._delete()
    on_deleted()
  }
</script>

<Slideover widthRem={26} {on_close}>
  {#snippet title()}
    <span>{page.data.t('sentence.sentence')}</span>
  {/snippet}

  <div class="panel-body">
    <!-- Fields get their own flex container so EntryField's empty-field
         `at-end` ordering stays among the fields (not after the actions). -->
    <div class="fields">
      {#each orthographies.all as orthography (orthography.code)}
        <EntryField
          value={sentence.text?.[orthography.code]}
          field="example_sentence"
          {can_edit}
          bcp={orthography.bcp}
          display={orthography.primary
            ? page.data.t('sentence.sentence')
            : `${orthography.name}: ${page.data.t('sentence.sentence')}`}
          on_update={new_value => save({ text: { ...(sentence.text || {}), [orthography.code]: new_value } })} />
      {/each}

      {#each glossing_languages as bcp (bcp)}
        <EntryField
          value={sentence.translation?.[bcp]}
          field="example_sentence"
          {bcp}
          {can_edit}
          display="{page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}: {page.data.t('sentence.translation')}"
          on_update={new_value => save({ translation: { ...(sentence.translation || {}), [bcp]: new_value } })} />
      {/each}
    </div>

    {#if can_edit}
      <label class="paragraph-toggle">
        <input
          type="checkbox"
          checked={!!sentence.ends_paragraph}
          onchange={() => save({ ends_paragraph: sentence.ends_paragraph ? null : 1 })} />
        {page.data.t('text.paragraph_break')}
      </label>

      {#if show_discourse}
        <label class="discourse-field">
          <span class="discourse-label">{page.data.t('discourse.role')}</span>
          <select
            class="discourse-select"
            value={sentence.discourse_role ?? ''}
            onchange={event => save({ discourse_role: event.currentTarget.value || null })}>
            <option value="">{page.data.t('discourse.none')}</option>
            {#each DISCOURSE_ROLES as role (role)}
              <option value={role}>{page.data.t({ dynamicKey: `discourse.${role}`, fallback: role })}</option>
            {/each}
          </select>
        </label>
      {/if}

      <div class="actions">
        <button type="button" class="btn-outline btn-sm" style="gap: 0.375rem; color: var(--danger)" onclick={delete_sentence}>
          <IconSystemUiconsTrash />
          {page.data.t('sentence.delete')}
        </button>
      </div>
    {/if}
  </div>
</Slideover>

<style>
  .panel-body {
    padding: 0.75rem;
  }

  .fields {
    display: flex;
    flex-direction: column;
  }

  .paragraph-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    margin-top: 1.25rem;
    color: color-mix(in srgb, var(--color) 85%, var(--background));
  }

  .discourse-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    margin-top: 1rem;
  }

  .discourse-label {
    color: var(--color-secondary);
  }

  .discourse-select {
    padding: 0.35rem 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid var(--border-color);
    background: var(--background);
    color: var(--color);
    font-size: 0.875rem;
  }

  .actions {
    margin-top: 1.5rem;
  }
</style>
