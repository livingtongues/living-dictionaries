<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { user } from '$lib/stores';
  import { firebaseApp } from '$sveltefirets';
  import { getFunctions, httpsCallable } from 'firebase/functions';

  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  let message = '';
  let email = '';

  let sending = false;
  let status: 'success' | 'fail';

  async function send() {
    if (sending) {
      return;
    }
    sending = true;
    try {
      const data = {
        message,
        email: ($user && $user.email) || email,
        name: ($user && $user.displayName) || 'Anonymous',
        url: window.location.href,
      };

      const functions = getFunctions(firebaseApp);
      await httpsCallable(functions, 'supportEmail')(data);
      status = 'success';
    } catch (err) {
      status = 'fail';
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
    sending = false;
  }
</script>

<Modal on:close class="bg-gray-100">
  <span slot="heading">
    {$_('header.contact_us', { default: 'Contact Us' })}
  </span>
  <Button
    href="https://docs.google.com/document/d/1MZGkBbnCiAch3tWjBOHRYPpjX1MVd7f6x5uVuwbxM-Q/edit?usp=sharing"
    target="_blank"
    class="w-full">
    <i class="far fa-question-circle" />
    <span class="ml-1">
      FAQ
      <!-- {$_('header.faq', { default: 'FAQ' })} -->
    </span>
  </Button>

  {#if !status}
    <form on:submit|preventDefault={send}>
      <div class="mt-3">
        <label class="block uppercase text-gray-700 text-xs font-bold mb-2" for="message">
          {$_('contact.what_is_your_question', {
            default: 'What is your question or comment?',
          })}
        </label>
        <textarea
          required
          rows="4"
          maxlength="1000"
          bind:value={message}
          class="form-input bg-white w-full"
          placeholder={$_('contact.enter_message', {
            default: 'Enter your message',
          }) + '...'} />
        <div class="flex text-xs">
          <div class="text-gray-500 ml-auto">{message.length}/1000</div>
        </div>
      </div>

      {#if !$user}
        <div class="mt-3">
          <label class="block uppercase text-gray-700 text-xs font-bold mb-2" for="email">
            {$_('contact.your_email_address', {
              default: 'Your Email Address',
            })}
          </label>
          <input
            type="email"
            required
            bind:value={email}
            class="form-input bg-white w-full"
            placeholder={$_('contact.email', { default: 'Email' })}
            style="direction: ltr" />
        </div>
      {/if}

      <div class="mt-5">
        <Button disabled={sending} loading={sending} form="primary" type="submit">
          {$_('contact.send_message', { default: 'Send Message' })}
        </Button>
        <Button disabled={sending} onclick={close} form="simple" color="black">
          {$_('misc.cancel', { default: 'Cancel' })}
        </Button>
      </div>
    </form>
  {:else if status == 'success'}
    <h4 class="text-lg mt-3 mb-4">
      <i class="fas fa-check" />
      {$_('contact.message_sent', {
        default: 'Message sent. We will reply as soon as we can.',
      })}
    </h4>
    <div>
      <Button onclick={close} color="black">
        {$_('misc.close', { default: 'Close' })}
      </Button>
    </div>
  {:else if status == 'fail'}
    <h4 class="text-xl mt-1 mb-4">
      {$_('contact.message_sent', {
        default: 'Message send failed. Check your internet connection or email us:',
      })}
      <a class="underline ml-1" href="mailto:annaluisa@livingtongues.org">
        annaluisa@livingtongues.org
      </a>
    </h4>
  {/if}
</Modal>
