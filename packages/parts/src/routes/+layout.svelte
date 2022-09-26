<script lang="ts">
  import { Layout } from 'kitbook';
</script>

<Layout title="Living Dictionaries Docs" githubURL="https://github.com/livingtongues/living-dictionaries/tree/main/packages/parts">
  <slot />
</Layout>

<style windi:preflights:global windi:safelist:global global>
  /* Temporary workaround until forms plugin bug in https://github.com/windicss/windicss/issues/457 is fixed */
  [type='text'],
  [type='email'],
  [type='url'],
  [type='password'],
  [type='number'],
  [type='date'],
  [type='datetime-local'],
  [type='month'],
  [type='search'],
  [type='tel'],
  [type='time'],
  [type='week'],
  [multiple],
  textarea,
  select {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-color: #fff;
    border-color: #6b7280;
    border-width: 1px;
    border-radius: 0px;
    padding-top: 0.5rem;
    padding-right: 0.75rem;
    padding-bottom: 0.5rem;
    padding-left: 0.75rem;
    font-size: 1rem;
    line-height: 1.5rem;
  }
  /* End workaround */

  input[type='checkbox'] {
    @apply focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded;
  }

  .form-input {
    @apply border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50;
  }
</style>