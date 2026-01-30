<script lang="ts">
  import DarkModeSupport from '../components/DarkModeSupport.svelte'

  interface Props {
    dark: boolean
    children?: import('svelte').Snippet
  }

  let { dark, children }: Props = $props()
</script>

<head>
  <!-- Help characters display properly. -->
  <meta http-equiv="content-type" content="text/html; charset=utf-8">
  <!-- Set the initial scale of the email. -->
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Force Outlook clients to render with a better MS engine. -->
  <meta http-equiv="x-ua-compatible" content="IE=Edge">
  <!-- Help prevent blue links and autolinking -->
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <!-- Prevent Apple from reformatting and zooming messages. -->
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

  {@html `<style type="text/css">/* Prevent WebKit and Windows mobile changing default text sizes */
body,
table,
td,
a {
  -webkit-text-size-adjust: 100%;
  -ms-text-size-adjust: 100%;
}

/* Remove spacing between tables in Outlook 2007 and up */
table,
td {
  mso-table-lspace: 0pt;
  mso-table-rspace: 0pt;
}

/* Allow smoother rendering of resized image in Internet Explorer */
img {
  -ms-interpolation-mode: bicubic;
}

/* RESET STYLES */
img {
  border: 0;
  height: auto;
  line-height: 100%;
  outline: none;
  text-decoration: none;
}

table {
  border-collapse: collapse !important;
}

/* iOS BLUE LINKS */
a[x-apple-data-detectors] {
  color: inherit !important;
  text-decoration: none !important;
  font-size: inherit !important;
  font-family: inherit !important;
  font-weight: inherit !important;
  line-height: inherit !important;
}

/* When an email is pulled into Outlook.com / Hotmail, any style rules present in the email are appended with .ExternalClass. Normalizing a few of these can help create a baseline for you to work from. */
.ExternalClass {
  width: 100%;
}

.ExternalClass * {
  line-height: 100%;
}
</style>`}

  <DarkModeSupport emulateEmailAddingDarkClasses={dark} />

  {@render children?.()}
</head>
