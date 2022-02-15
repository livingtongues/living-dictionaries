<script lang="ts">
  import { FirebaseUiAuth, updateUserData } from '$sveltefirets';
  import type { LanguageCode } from '$sveltefirets/components/languageCodes';
  import { languagesWithTranslations } from '$sveltefirets/components/languageCodes';
  import { _, locale } from 'svelte-i18n';

  let languageCode: LanguageCode = 'en';

  let localeAbbrev = $locale.substring(0, 2);
  if (localeAbbrev === 'he') localeAbbrev = 'iw';
  if (!Object.values(languagesWithTranslations).includes(localeAbbrev)) {
    localeAbbrev = 'en'; // Malay 'ms' and Assamese 'as' not yet available
  }
  languageCode = localeAbbrev as LanguageCode;

  import Modal from '$lib/components/ui/Modal.svelte';
  export let context: 'force' = undefined;
</script>

<Modal on:close>
  <span slot="heading">{$_('header.login', { default: 'Sign In' })}</span>
  {#if context === 'force'}
    <h4 class="text-lg text-center">
      {$_('header.please_create_account', {
        default: 'Please create an account',
      })}
    </h4>
  {/if}
  <FirebaseUiAuth
    tosUrl="https://livingdictionaries.app/terms"
    {languageCode}
    on:close
    on:updateuserdata={(e) => updateUserData(e.detail.user, e.detail.isNewUser)} />
</Modal>
