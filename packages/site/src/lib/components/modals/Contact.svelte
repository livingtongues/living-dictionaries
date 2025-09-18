<script lang="ts">
  import { Button, Form, Modal } from 'svelte-pieces'
  import { createEventDispatcher } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import type { SupportRequestBody } from '$api/email/support/+server'
  import type { LearningMaterialsRequestBody } from '$api/email/learning_materials/+server'
  import enBase from '$lib/i18n/locales/en.json'
  import { post_request } from '$lib/helpers/get-post-requests'
  import { api_request_access } from '$api/email/request_access/_call'

  export let subject: Subjects = undefined
  $: ({ dictionary, user, about_is_too_short } = $page.data)
  $: if (dictionary && subject === 'public_dictionary') warn_if_about_too_short()

  function warn_if_about_too_short() {
    if (about_is_too_short()) {
      close()
      alert($page.data.t('about.message'))
      goto(`/${dictionary.id}/about`)
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
  $: filteredSubjects = typedSubjects.filter((subjects) => {
    if (!dictionary && subjects[0] === 'public_dictionary') {
      return false
    }
    return true
  })

  const dispatch = createEventDispatcher<{ close: boolean }>()

  function close() {
    dispatch('close')
  }

  let message = ''
  let email = ''

  let status: 'success' | 'fail'

  async function send() {
    if (dictionary && subject === 'request_access') {
      const { error } = await api_request_access({
        message,
        email: $user?.email || email,
        name: $user?.user_metadata.full_name || 'Anonymous',
        url: window.location.href,
        dictionaryId: dictionary.id,
        dictionaryName: dictionary.name,
      })

      if (error) {
        status = 'fail'
        return alert(`${$page.data.t('misc.error')}: ${error.message}`)
      }
    } else if (subject === 'learning_materials') {
      const { error } = await post_request<LearningMaterialsRequestBody, null>('/api/email/learning_materials', {
        message,
        email: $user?.email || email,
        name: $user?.user_metadata.full_name || 'Anonymous',
        url: window.location.href,
        dictionaryName: dictionary?.name,
      })

      if (error) {
        status = 'fail'
        return alert(`${$page.data.t('misc.error')}: ${error.message}`)
      }
    } else {
      const { error } = await post_request<SupportRequestBody, null>('/api/email/support', {
        message,
        email: $user?.email || email,
        name: $user?.user_metadata.full_name || 'Anonymous',
        url: window.location.href,
        subject: enBase.contact[subject],
      })

      if (error) {
        status = 'fail'
        return alert(`${$page.data.t('misc.error')}: ${error.message}`)
      }
    }

    status = 'success'
  }
</script>

<Modal on:close class="bg-gray-100">
  <span slot="heading">
    <i class="far fa-question-circle" />
  </span>
  <div class="flex flex-col mb-5">
    <Button
      onclick={() => {
        goto('/tutorials')
        close()
      }}
      class="mb-2">
      <span class="i-fluent-learning-app-24-regular -mt-2px" />
      {$page.data.t('header.tutorials')}
    </Button>
    <Button
      href="https://docs.google.com/document/d/1MZGkBbnCiAch3tWjBOHRYPpjX1MVd7f6x5uVuwbxM-Q/edit?usp=sharing"
      target="_blank">
      <i class="far fa-question-circle" />
      <span class="ml-1">
        FAQ
        <!-- {$page.data.t('header.faq')} -->
      </span>
    </Button>
  </div>

  {#if !dictionary.con_language_description}
    <hr class="my-5" />

    <h2 class="text-xl mb-3">
      <i class="far fa-comment" />
      {$page.data.t('header.contact_us')}
    </h2>

    {#if !status}
      <Form let:loading onsubmit={send}>
        <div class="my-2">
          <select class="w-full" bind:value={subject}>
            <option disabled selected value="">{$page.data.t('contact.select_topic')}:</option>
            {#each filteredSubjects as [key, value]}
              <option value={key}>{$page.data.t(value)}</option>
            {/each}
          </select>
        </div>
        <label class="block text-gray-700 text-sm font-bold mb-2" for="message">
          {$page.data.t('contact.what_is_your_question')}
        </label>
        <textarea
          name="message"
          required
          rows="4"
          maxlength="1000"
          bind:value={message}
          class="form-input bg-white w-full"
          placeholder={`${$page.data.t('contact.enter_message')}...`} />
        <div class="flex text-xs">
          <div class="text-gray-500 ml-auto">{message.length}/1000</div>
        </div>

        {#if !$user}
          <div class="mt-3">
            <label class="block uppercase text-gray-700 text-xs font-bold mb-2" for="email">
              {$page.data.t('contact.your_email_address')}
            </label>
            <input
              type="email"
              required
              bind:value={email}
              class="form-input bg-white w-full"
              placeholder={$page.data.t('contact.email')}
              style="direction: ltr" />
          </div>
        {/if}

        <div class="mt-5">
          <Button {loading} form="filled" type="submit">
            {$page.data.t('contact.send_message')}
          </Button>
          <Button disabled={loading} onclick={close} form="simple" color="black">
            {$page.data.t('misc.cancel')}
          </Button>
        </div>
      </Form>
    {:else if status === 'success'}
      <h4 class="text-lg mt-3 mb-4">
        <i class="fas fa-check" />
        {$page.data.t('contact.message_sent')}
      </h4>
      <div>
        <Button onclick={close} color="black">
          {$page.data.t('misc.close')}
        </Button>
      </div>
    {/if}
  {:else if status === 'fail'}
    <h4 class="text-xl mt-1 mb-4">
      {$page.data.t('contact.message_failed')}
      <a class="underline ml-1" href="mailto:dictionaries@livingtongues.org">
        dictionaries@livingtongues.org
      </a>
    </h4>
  {/if}
</Modal>
