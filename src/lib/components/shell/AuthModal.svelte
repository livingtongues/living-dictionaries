<script lang="ts">
  import { FirebaseUiAuth, updateUserData } from '$sveltefirets';
  import { _, locale } from 'svelte-i18n';

  // TODO use LanguageCodes type from sveltefirets
  let languageCode = $locale.substring(0, 2);
  // https://github.com/firebase/firebaseui-web/blob/master/LANGUAGES.md
  if (languageCode === 'he') languageCode = 'iw';
  if (languageCode === 'ms') languageCode = 'en'; // Malay is not yet available
  if (languageCode === 'as') languageCode = 'en'; // Assamese is not yet available

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
    on:updateuserdata={(e) => updateUserData(e.detail.user, e.detail.isNewUser)}
  />
</Modal>
