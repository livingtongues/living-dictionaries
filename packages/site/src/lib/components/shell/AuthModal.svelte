<script lang="ts">
  import {
    FirebaseUiAuth,
    saveUserData,
    type LanguageCode,
    languagesWithTranslations,
    type AuthResult,
  } from 'sveltefirets';
  import { t, locale } from 'svelte-i18n';
  import { Modal } from 'svelte-pieces';
  import { createEventDispatcher } from 'svelte';
  import { apiFetch } from '$lib/client/apiFetch';
  import type { NewUserRequestBody } from '../../../routes/api/email/new_user/+server';

  let languageCode: LanguageCode = 'en';

  let localeAbbrev = $locale.substring(0, 2);
  if (localeAbbrev === 'he') localeAbbrev = 'iw';
  if (!Object.values(languagesWithTranslations).includes(localeAbbrev))
    localeAbbrev = 'en'; // Malay 'ms' and Assamese 'as' not yet available

  languageCode = localeAbbrev as LanguageCode;

  export let context: 'force' = undefined;

  const dispatch = createEventDispatcher<{
    close: boolean;
  }>();

  async function handleAuthResult({ detail }: CustomEvent<AuthResult>) {
    try {
      saveUserData(detail);
      if (detail.additionalUserInfo.isNewUser) {
        const auth_token = await detail.user.getIdToken();
        const response = await apiFetch<NewUserRequestBody>('/api/email/new_user', {
          auth_token,
          user: {
            email: detail.user.email,
            displayName: detail.user.displayName || detail.user.email,
          },
        });
        if (response.status !== 200) {
          const body = await response.json();
          throw new Error(body.message);
        }
      }
    } catch (err) {
      alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
      console.error(err);
    }
    dispatch('close');
  }
</script>

<Modal on:close>
  <span slot="heading">{$t('header.login', { default: 'Sign In' })}</span>
  {#if context === 'force'}
    <h4 class="text-lg text-center">
      {$t('header.please_create_account', {
        default: 'Please create an account',
      })}
    </h4>
  {/if}

  <FirebaseUiAuth
    continueUrl="/account"
    signInWith={{ google: true, emailPasswordless: true }}
    tosUrl="https://livingdictionaries.app/terms"
    {languageCode}
    on:authresult={handleAuthResult} />
</Modal>
