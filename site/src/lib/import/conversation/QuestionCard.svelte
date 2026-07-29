<script lang="ts">
  import type { QuestionOption, ThreadQuestionRow } from '$lib/db/server/import-conversations'
  import IconMdiCheckCircle from '~icons/mdi/check-circle'
  import IconMdiFormatListBulleted from '~icons/mdi/format-list-bulleted'
  import IconMdiOpenInNew from '~icons/mdi/open-in-new'
  import { page } from '$app/state'
  import { api_conversation_answer_question, conversation_artifact_url } from '$api/v1/dictionaries/[id]/conversations/_call'
  import { entries_query_href } from '$lib/search/entries-query-link'
  import { toast } from '$lib/state/toast.svelte'

  interface Props {
    question: ThreadQuestionRow
    position: number
    dictionary_id: string
    thread_id: string
    /** The report the question's `report_anchor` points into, when there is one. */
    report_artifact_id: string | null
    on_answered: () => void
  }
  const { question, position, dictionary_id, thread_id, report_artifact_id, on_answered }: Props = $props()
  const { t } = $derived(page.data)

  const options = $derived<QuestionOption[]>(question.options_json ? JSON.parse(question.options_json) : [])
  const saved_values = $derived<string[]>(question.answer_values_json ? JSON.parse(question.answer_values_json) : [])

  let draft_text = $state<string | null>(null)
  let draft_values = $state<string[] | null>(null)
  const answer_text = $derived(draft_text ?? question.answer_text ?? '')
  const answer_values = $derived(draft_values ?? saved_values)
  let saving = $state(false)

  const answered = $derived(question.status === 'answered')
  const dirty = $derived(
    answer_text.trim() !== (question.answer_text ?? '').trim()
      || answer_values.join('\u0000') !== saved_values.join('\u0000'),
  )
  const anchor_href = $derived(
    report_artifact_id && question.report_anchor
      ? `${conversation_artifact_url({ dictionary_id, thread_id, artifact_id: report_artifact_id })}${question.report_anchor}`
      : null,
  )
  // The entries this question is about. `page.params.dictionaryId` is the URL
  // the manager is already on (the canonical slug); `dictionary_id` is the
  // fallback for anywhere this card renders outside a dictionary route.
  const entries_href = $derived(question.entries_query
    ? entries_query_href({ dictionary_url: page.params.dictionaryId || dictionary_id, entries_query: question.entries_query })
    : null)

  function toggle_value(value: string) {
    const current = answer_values
    if (question.kind === 'choice') {
      draft_values = current.includes(value) ? [] : [value]
      return
    }
    draft_values = current.includes(value) ? current.filter(item => item !== value) : [...current, value]
  }

  async function save() {
    if (saving)
      return
    saving = true
    const { error } = await api_conversation_answer_question({
      dictionary_id,
      thread_id,
      question_id: question.id,
      ...(question.kind === 'text' ? { answer_text } : { answer_values }),
    })
    saving = false
    if (error) {
      toast.error(error.message)
      return
    }
    draft_text = null
    draft_values = null
    on_answered()
  }
</script>

<li class="question" class:answered>
  <div class="head">
    <span class="position">{position}</span>
    <h5>{question.title}</h5>
    {#if answered}
      <span class="answered-badge"><IconMdiCheckCircle /> {t('import_page.question_saved')}</span>
    {/if}
  </div>

  {#if question.body_html}
    <!-- Agent-authored context, written by the team that ran the import. -->
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    <div class="context">{@html question.body_html}</div>
  {/if}

  {#if entries_href || anchor_href}
    <div class="links">
      <!-- The question asked ON its rows: the manager answers from the entries
           themselves rather than from memory (2026-07-29). -->
      {#if entries_href}
        <a class="btn-primary btn-sm" href={entries_href} target="_blank" rel="noopener">
          <IconMdiFormatListBulleted />
          {question.entries_query_label || t('import_page.question_entries_link')}
        </a>
      {/if}
      {#if anchor_href}
        <a class="anchor" href={anchor_href} target="_blank" rel="noopener">
          {t('import_page.question_context_link')}
          <IconMdiOpenInNew />
        </a>
      {/if}
    </div>
  {/if}

  {#if question.kind === 'text'}
    <textarea
      rows="2"
      value={answer_text}
      placeholder={t('import_page.question_placeholder')}
      oninput={(event) => { draft_text = event.currentTarget.value }}></textarea>
  {:else}
    <div class="options">
      {#each options as option (option.value)}
        <label class="option">
          <input
            type={question.kind === 'choice' ? 'radio' : 'checkbox'}
            name={`question-${question.id}`}
            value={option.value}
            checked={answer_values.includes(option.value)}
            onchange={() => toggle_value(option.value)} />
          <span>{option.label}</span>
        </label>
      {/each}
    </div>
  {/if}

  <!-- Always rendered, even when there's nothing to save: a button that only
       appears once you type reads as "maybe this autosaves?" (Jacob, 2026-07-25). -->
  <div class="save-row">
    <button type="button" class="btn-primary btn-sm" disabled={saving || !dirty} onclick={save}>
      {#if saving}
        {t('import_page.sending')}
      {:else if answered && !dirty}
        {t('import_page.question_saved')}
      {:else}
        {t('import_page.question_save')}
      {/if}
    </button>
  </div>
</li>

<style>
  .question {
    border: 1px solid color-mix(in srgb, var(--color) 14%, var(--background));
    border-radius: 0.75rem;
    padding: 0.7rem 0.85rem;
    background: var(--background);
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .question.answered {
    border-color: color-mix(in srgb, var(--success) 35%, var(--background));
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .position {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-secondary);
    flex-shrink: 0;
  }
  h5 {
    font-weight: 600;
    font-size: 0.9rem;
    flex-grow: 1;
    min-width: 0;
  }
  .answered-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--success);
  }
  .context {
    font-size: 0.82rem;
    line-height: 1.5;
    color: color-mix(in srgb, var(--color) 78%, var(--background));
  }
  .links {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .links a.btn-primary {
    gap: 0.3rem;
    font-weight: 600;
    text-decoration: none;
  }
  .anchor {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.76rem;
    color: var(--primary);
    text-decoration: underline;
  }
  textarea {
    width: 100%;
    resize: vertical;
    font-size: 0.875rem;
  }
  .options {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .option {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.86rem;
    cursor: pointer;
  }
  .save-row {
    display: flex;
    justify-content: flex-end;
  }
</style>
