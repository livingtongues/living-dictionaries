<script lang="ts">
  import FirebaseUiAuth from '$sveltefire/components/FirebaseUiAuth.svelte';
  import { updateUserData } from '$sveltefire/helpers/updateUserData';
  import { _, locale } from 'svelte-i18n';

  let localizedAbbrev = $locale.substring(0, 2);
  // https://github.com/firebase/firebaseui-web/blob/master/LANGUAGES.md
  if (localizedAbbrev === 'he') localizedAbbrev = 'iw';
  if (localizedAbbrev === 'ms') localizedAbbrev = 'en'; // Malay is not yet available

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
    {localizedAbbrev}
    on:close
    on:updateuserdata={(e) => updateUserData(e.detail.user, e.detail.isNewUser)} />
</Modal>
