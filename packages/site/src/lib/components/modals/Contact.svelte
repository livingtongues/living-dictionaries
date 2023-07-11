<script lang="ts">
  import { t } from 'svelte-i18n';
  import { Button, Modal, Form } from 'svelte-pieces';
  import { user } from '$lib/stores';
  import { goto } from '$app/navigation';
  import { createEventDispatcher } from 'svelte';
  import { apiFetch } from '$lib/client/apiFetch';
  import type { SupportRequestBody } from '../../../routes/api/email/support/+server';

  const subjects = {
    'delete_dictionary': 'Delete a dictionary',
    'public_dictionary': 'Make a dictionary public',
    'import_data': 'Import data',
    // 'data_fields': 'Optional data fields', //Comment this in case we want to include it again in the future
    'request_access': 'Request editing access',
    'report_problem': 'Report a problem',
    'other': 'Other topic'
  }
  type Subjects = keyof typeof subjects;
  export let subject: Subjects = undefined;

  const dispatch = createEventDispatcher<{ close: boolean }>();

  function close() {
    dispatch('close');
  }

  let message = '';
  let email = '';
  
  let status: 'success' | 'fail';

  async function send() {
    try {
      const response = await apiFetch<SupportRequestBody>('/api/email/support', {
        message,
        email: $user?.email || email,
        name: $user?.displayName || 'Anonymous',
        url: window.location.href,
        subject: subjects[subject]
      });

      if (response.status !== 200) {
        const body = await response.json();
        throw new Error(body.message);
      }

      status = 'success';
    } catch (err) {
      status = 'fail';
      alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
    }
  }
</script>

<Modal on:close class="bg-gray-100">
  <span slot="heading">
    <i class="far fa-question-circle" />
  </span>
  <div class="flex flex-col mb-5">
    <Button
      onclick={() => {
        goto('/tutorials');
        close();
      }}
      class="mb-2">
      <span class="i-fluent-learning-app-24-regular -mt-2px" />
      {$t('header.tutorials', {
        default: 'Tutorials',
      })}
    </Button>
    <Button
      href="https://docs.google.com/document/d/1MZGkBbnCiAch3tWjBOHRYPpjX1MVd7f6x5uVuwbxM-Q/edit?usp=sharing"
      target="_blank">
      <i class="far fa-question-circle" />
      <span class="ml-1">
        FAQ
        <!-- {$_('header.faq', { default: 'FAQ' })} -->
      </span>
    </Button>
  </div>

  <hr class="my-5" />

  <h2 class="text-xl mb-3">
    <i class="far fa-comment" />
    {$t('header.contact_us', { default: 'Contact Us' })}
  </h2>

  {#if !status}
    <Form let:loading onsubmit={send}>
      <div class="my-2">
        <select class="w-full" bind:value={subjects[subject]}>
          <option disabled selected value="">{$t('contact.select_topic', { default: 'Select a topic' })}:</option>
          {#each Object.entries(subjects) as [key, title]}
            <option data-value={subject}>{$t('contact.' + key, { default: title })}</option>
          {/each}
        </select>
      </div>
      <label class="block text-gray-700 text-sm font-bold mb-2" for="message">
        {$t('contact.what_is_your_question', {
          default: 'What is your question or comment?',
        })}
      </label>
      <textarea
        name="message"
        required
        rows="4"
        maxlength="1000"
        bind:value={message}
        class="form-input bg-white w-full"
        placeholder={$t('contact.enter_message', {
          default: 'Enter your message',
        }) + '...'} />
      <div class="flex text-xs">
        <div class="text-gray-500 ml-auto">{message.length}/1000</div>
      </div>

      {#if !$user}
        <div class="mt-3">
          <label class="block uppercase text-gray-700 text-xs font-bold mb-2" for="email">
            {$t('contact.your_email_address', {
              default: 'Your Email Address',
            })}
          </label>
          <input
            type="email"
            required
            bind:value={email}
            class="form-input bg-white w-full"
            placeholder={$t('contact.email', { default: 'Email' })}
            style="direction: ltr" />
        </div>
      {/if}

      <div class="mt-5">
        <Button {loading} form="filled" type="submit">
          {$t('contact.send_message', { default: 'Send Message' })}
        </Button>
        <Button disabled={loading} onclick={close} form="simple" color="black">
          {$t('misc.cancel', { default: 'Cancel' })}
        </Button>
      </div>
    </Form>
  {:else if status == 'success'}
    <h4 class="text-lg mt-3 mb-4">
      <i class="fas fa-check" />
      {$t('contact.message_sent', {
        default: 'Message sent. We will reply as soon as we can.',
      })}
    </h4>
    <div>
      <Button onclick={close} color="black">
        {$t('misc.close', { default: 'Close' })}
      </Button>
    </div>
  {:else if status == 'fail'}
    <h4 class="text-xl mt-1 mb-4">
      {$t('contact.message_failed', {
        default: 'Message send failed. Check your internet connection or email us:',
      })}
      <a class="underline ml-1" href="mailto:annaluisa@livingtongues.org">
        annaluisa@livingtongues.org
      </a>
    </h4>
  {/if}
</Modal>
