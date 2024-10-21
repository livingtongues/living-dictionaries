<script lang="ts">
  import DarkModeSupport from '../components/DarkModeSupport.svelte'
  import style from './client-specific-styles.css?inline'

  export let dark: boolean
</script>

<head>
  <!-- Help character display properly. -->
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <!-- Set the initial scale of the email. -->
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Force Outlook clients to render with a better MS engine. -->
  <meta http-equiv="X-UA-Compatible" content="IE=Edge">
  <!-- Help prevent blue links and autolinking -->
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <!-- prevent Apple from reformatting and zooming messages. -->
  <meta name="x-apple-disable-message-reformatting">

  <!-- Allow for better image rendering on Windows hi-DPI displays. -->
  <!-- [if mso]>
<noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
</noscript>
<![endif] -->

  {@html `<style type="text/css">${style}</style>`}

  <DarkModeSupport emulateEmailAddingDarkClasses={dark} />

  <slot />
</head>
