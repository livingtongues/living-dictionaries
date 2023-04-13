<script lang="ts">
  import {
    FirebaseUiAuth,
    saveUserData,
    type LanguageCode,
    languagesWithTranslations,
  } from 'sveltefirets';
  import { t, locale } from 'svelte-i18n';
  import { Modal } from 'svelte-pieces';
  import { createEventDispatcher } from 'svelte';

  let languageCode: LanguageCode = 'en';

  let localeAbbrev = $locale.substring(0, 2);
  if (localeAbbrev === 'he') localeAbbrev = 'iw';
  if (!Object.values(languagesWithTranslations).includes(localeAbbrev)) {
    localeAbbrev = 'en'; // Malay 'ms' and Assamese 'as' not yet available
  }
  languageCode = localeAbbrev as LanguageCode;

  export let context: 'force' = undefined;

  const dispatch = createEventDispatcher<{
    close: boolean;
  }>();
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
    on:success={() => dispatch('close')}
    on:authresult={(e) => saveUserData(e.detail)} />
</Modal>
