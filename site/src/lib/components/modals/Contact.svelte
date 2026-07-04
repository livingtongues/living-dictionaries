<script lang="ts">
  import IconFluentLearningApp24Regular from '~icons/fluent/learning-app-24-regular'
  import Button from '$lib/components/ui/Button.svelte'
  import Form from '$lib/components/ui/Form.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { api_contact } from '$api/contact/_call'

  interface Props {
    subject?: Subjects
    on_close: () => void
  }

  let { subject = $bindable(undefined), on_close }: Props = $props()

  function warn_if_about_too_short() {
    if (about_is_too_short()) {
      on_close()
      alert(page.data.t('about.message'))
      goto(`/${dictionary.url}/about`)
    }
  }

  const subjects = {
    delete_dictionary: 'contact.delete_dictionary',
    public_dictionary: 'contact.public_dictionary',
    import_data: 'contact.import_data',
    request_access: 'contact.request_access',
    learning_materials: 'contact.learning',
    report_problem: 'contact.report_problem',
    other: 'contact.other',
  } as const

  type Subjects = keyof typeof subjects
  type SubjectValues = typeof subjects[Subjects]
  const typedSubjects = Object.entries(subjects) as [Subjects, SubjectValues][]

  let message = $state('')
  let email = $state('')

  let status: 'success' | 'fail' = $state()

  async function send() {
    if (!subject) return
    const subject_label = page.data.t(subjects[subject])
    const { error } = await api_contact({
      name: user?.name || 'Anonymous',
      email: user?.email || email,
      message,
      url: window.location.href,
      subject: dictionary?.name ? `${subject_label} — ${dictionary.name}` : subject_label,
      subject_key: subject,
      dictionary_id: dictionary?.id,
      dictionary_name: dictionary?.name,
    })

    if (error) {
      status = 'fail'
      return alert(`${page.data.t('misc.error')}: ${error.message}`)
    }

    status = 'success'
  }
  let { dictionary, auth_user, about_is_too_short } = $derived(page.data)
  const user = $derived(auth_user.user)
  $effect(() => {
    if (dictionary && subject === 'public_dictionary') warn_if_about_too_short()
  })
  const filteredSubjects = $derived(typedSubjects.filter((subjects) => {
    if (!dictionary && subjects[0] === 'public_dictionary') {
      return false
    }
    return true
  }))
</script>

<Modal {on_close} class="contact-modal">
  {#snippet heading()}
    <span>
      <i class="far fa-question-circle"></i>
    </span>
  {/snippet}
  <div style="display: flex; flex-direction: column; margin-bottom: 1.25rem">
    <Button
      onclick={() => {
        goto('/tutorials')
        on_close()
      }}
      class="tutorials-button">
      <IconFluentLearningApp24Regular class="icon-inline" style="margin-top: -2px" />
      {page.data.t('header.tutorials')}
    </Button>
    <Button
      href="https://docs.google.com/document/d/1MZGkBbnCiAch3tWjBOHRYPpjX1MVd7f6x5uVuwbxM-Q/edit?usp=sharing"
      target="_blank">
      <i class="far fa-question-circle"></i>
      <span style="margin-left: 0.25rem">
        FAQ
        <!-- {page.data.t('header.faq')} -->
      </span>
    </Button>
  </div>

  {#if !dictionary?.con_language_description}
    <hr style="margin-top: 1.25rem; margin-bottom: 1.25rem" />

    <h2 class="contact-heading">
      <i class="far fa-comment"></i>
      {page.data.t('header.contact_us')}
    </h2>

    {#if !status}
      <Form onsubmit={send}>
        {#snippet children({ loading })}
          <div style="margin-top: 0.5rem; margin-bottom: 0.5rem">
            <select style="width: 100%" required bind:value={subject}>
              <option disabled selected value="">{page.data.t('contact.select_topic')}:</option>
              {#each filteredSubjects as [key, value] (key)}
                <option value={key}>{page.data.t(value)}</option>
              {/each}
            </select>
          </div>
          <label class="message-label" for="message">
            {page.data.t('contact.what_is_your_question')}
          </label>
          <textarea
            name="message"
            required
            rows="4"
            maxlength="1000"
            bind:value={message}
            class="white-input"
            placeholder={`${page.data.t('contact.enter_message')}...`}></textarea>
          <div class="counter-row">
            <div class="counter">{message.length}/1000</div>
          </div>

          {#if !user}
            <div style="margin-top: 0.75rem">
              <label class="email-label" for="email">
                {page.data.t('contact.your_email_address')}
              </label>
              <input
                type="email"
                required
                bind:value={email}
                class="white-input"
                placeholder={page.data.t('contact.email')}
                style="direction: ltr" />
            </div>
          {/if}

          <div style="margin-top: 1.25rem">
            <Button {loading} form="filled" type="submit">
              {page.data.t('contact.send_message')}
            </Button>
            <Button disabled={loading} onclick={on_close} form="simple" color="black">
              {page.data.t('misc.cancel')}
            </Button>
          </div>
        {/snippet}
      </Form>
    {:else if status === 'success'}
      <h4 class="success-heading">
        <i class="fas fa-check"></i>
        {page.data.t('contact.message_sent')}
      </h4>
      <div>
        <Button onclick={on_close} color="black">
          {page.data.t('misc.close')}
        </Button>
      </div>
    {:else if status === 'fail'}
      <h4 class="fail-heading">
        {page.data.t('contact.message_failed')}
        <a style="text-decoration-line: underline; margin-left: 0.25rem" href="mailto:dictionaries@livingtongues.org">
          dictionaries@livingtongues.org
        </a>
      </h4>
    {/if}
  {/if}
</Modal>

<style>
  /* the Modal portals to body — needs the extra `div` to outrank the panel's own bg */
  :global(div.contact-modal) {
    background-color: var(--surface) !important; /* ≈ gray-100 */
  }

  :global(.tutorials-button) {
    margin-bottom: 0.5rem;
  }

  .contact-heading {
    font-size: 1.25rem;
    line-height: 1.75rem;
    margin-bottom: 0.75rem;
  }

  .message-label {
    display: block;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .white-input {
    background-color: var(--background); /* the modal bg is surface-gray; inputs stay white */
    width: 100%;
  }

  .counter-row {
    display: flex;
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .counter {
    color: var(--color-secondary); /* ≈ gray-500 */
    margin-left: auto;
  }

  .email-label {
    display: block;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .success-heading {
    font-size: 1.125rem;
    line-height: 1.75rem;
    margin-top: 0.75rem;
    margin-bottom: 1rem;
  }

  .fail-heading {
    font-size: 1.25rem;
    line-height: 1.75rem;
    margin-top: 0.25rem;
    margin-bottom: 1rem;
  }
</style>
