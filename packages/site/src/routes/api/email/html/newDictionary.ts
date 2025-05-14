export default function (dictionaryName: string, dictionaryId: string) {
  return `<html lang="en">

<head>
  <title>New Living Dictionary Created</title>

  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <style type="text/css">
    /* CLIENT-SPECIFIC STYLES */
    body,
    table,
    td,
    a {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }

    /* Prevent WebKit and Windows mobile changing default text sizes */
    table,
    td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }

    /* Remove spacing between tables in Outlook 2007 and up */
    img {
      -ms-interpolation-mode: bicubic;
    }

    /* Allow smoother rendering of resized image in Internet Explorer */

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

    body {
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
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

    /* MOBILE STYLES */
    @media screen and (max-width: 525px) {

      /* ALLOWS FOR FLUID TABLES */
      .wrapper {
        width: 100% !important;
        max-width: 100% !important;
      }

      /* ADJUSTS LAYOUT OF LOGO IMAGE */
      .logo img {
        margin: 0 auto !important;
      }

      /* USE THESE CLASSES TO HIDE CONTENT ON MOBILE */
      .mobile-hide {
        display: none !important;
      }

      .img-max {
        max-width: 100% !important;
        width: 100% !important;
        height: auto !important;
      }

      /* FULL-WIDTH TABLES */
      .responsive-table {
        width: 100% !important;
      }

      /* UTILITY CLASSES FOR ADJUSTING PADDING ON MOBILE */
      .padding {
        padding-left: 2% !important;
        padding-right: 2% !important;

      }

      /* ADJUST BUTTONS ON MOBILE */
      .mobile-button-container {
        margin: 0 auto;
        width: 100% !important;
      }

      .mobile-button {
        padding: 15px !important;
        border: 0 !important;
        font-size: 16px !important;
        display: block !important;
      }

    }

    /* ANDROID CENTER FIX */
    div[style*="margin: 16px 0;"] {
      margin: 0 !important;
    }
  </style>
</head>

<body style="margin: 0 !important; padding: 0 !important;">
  <!-- HIDDEN PREHEADER TEXT -->
  <div
    style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: Helvetica, Arial, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Nice work on creating the ${dictionaryName} Living Dictionary. Here's some convenient information that will help
    you build your dictionary.
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td bgcolor="#546e7a" style="background: #546e7a center;" align="center">
        <!--[if (gte mso 9)|(IE)]>
                <table align="center" border="0" cellspacing="0" cellpadding="0" width="500">
                <tr>
                <td align="center" valign="top" width="500">
                <![endif]-->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px;" class="wrapper">
          <tr>
            <td align="center" valign="top"
              style="padding: 12px 0; font-family: Helvetica, Arial, sans-serif; font-size: 20px" class="logo">
              <a target="_blank"
                href="https://livingdictionaries.app/?utm_source=function&amputm_medium=email&amputm_campaign=LDCreated"
                style="color: white; text-decoration: none;">
                Living Dictionaries
              </a>
            </td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
                </td>
                </tr>
                </table>
                <![endif]-->
      </td>
    </tr>

    <tr>
      <td align="center" style="padding: 15px 15px 35px;" bgcolor="#ffffff">
        <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellspacing="0" cellpadding="0" width="500">
            <tr>
            <td align="center" valign="top" width="500">
            <![endif]-->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" class="responsive-table"
          style="max-width: 500px;">
          <tr>
            <td>
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" class="padding"
                    style="font-size: 28px; font-family: Helvetica, Arial, sans-serif; color: #333333; padding-top: 25px;">
                    Living Dictionary Created
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Article -->
          <tr>
            <td>
              <table width="100%" border="0" cellspacing="0" cellpadding="0">

                <!--Paragraph-->
                <tr>
                  <td align="left"
                    style="padding: 20px 0 0; font-size: 16px; line-height: 25px; font-family: Helvetica, Arial, sans-serif; color: #666666;"
                    class="padding">
                    Great! You've just created a new dictionary titled
                    <a style="color: #546e7a" target="_blank"
                      href="https://livingdictionaries.app/${dictionaryId}/?utm_source=function&amputm_medium=email&amputm_campaign=LDCreated">${dictionaryName}</a>.
                    To conveniently return to your dictionary, add a bookmark to
                    <strong>livingdictionaries.app/${dictionaryId}</strong><br /><br />

                      If you ever have any questions or comments, feel free to reply to this email or or use the "Contact Us" button from within the web app.<br /><br />

                      We recommend filling out the <a style="color: #546e7a" target="_blank"
                        href="https://livingdictionaries.app/${dictionaryId}/about">"About section"</a> of your dictionary as soon as possible. Thanks!
                  </td>
                </tr>

                <!--CTA Button-->
                <tr>
                  <td align="center">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding: 20px 0 0;" class="padding">
                          <table border="0" cellspacing="0" cellpadding="0" class="mobile-button-container">
                            <tr>
                              <td align="center" style="border-radius: 3px;" bgcolor="#546e7a">
                                <a target="_blank"
                                  href="https://livingdictionaries.app/${dictionaryId}/?utm_source=function&amputm_medium=email&amputm_campaign=LDCreated"
                                  style="font-size: 16px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 3px; padding: 15px 25px; border: 1px solid #546e7a; display: inline-block;"
                                  class="mobile-button">
                                  Open Dictionary
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td bgcolor="#ddd" align="center" style="padding: 20px 4px;">
        <!--[if (gte mso 9)|(IE)]>
                <table align="center" border="0" cellspacing="0" cellpadding="0" width="500">
                <tr>
                <td align="center" valign="top" width="500">
                <![endif]-->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" align="center" style="max-width: 500px;"
          class="responsive-table">
          <tr>
            <td align="center" style="font-size: 14px; line-height: 18px; font-family: Helvetica, Arial, sans-serif;">
              <a style="font-weight:bold; color:#555555; text-decoration:none" target="_blank"
                href="https://livingtongues.org/">
                Living Tongues Institute for Endangered Languages
              </a>
            </td>
          </tr>
          <tr>
            <td align="center"
              style="font-family: Helvetica, arial, sans-serif; font-size: 13px; color: #889098; line-height: 21px;">
              4676 Commercial St SE, # 454 | Salem, Oregon, OR 97302
            </td>
          </tr>


          <tr>
            <td align="center" style="padding-top:15px;">
              <table width="120" align="center" border="0" cellpadding="0" cellspacing="0">
                <tbody>
                  <tr>
                    <td width="47" height="43" align="center">
                      <a target="_blank" href="https://www.facebook.com/living.tongues/">
                        <img src="https://edge.athletic.net/emails/share/fb-circle.png" alt="Facebook" border="0" width="43" height="43" style="display:block; border:none; outline:none; text-decoration:none;" />
                      </a>
                    </td>
                    <td align="left" width="15" style="font-size:1px; line-height:1px;">&#160;</td>
                    <td width="48" height="43" align="center">
                      <a target="_blank" href="https://twitter.com/livingtongues">
                        <img src="https://edge.athletic.net/emails/share/twitt-circle.png" alt="Twitter" border="0" width="43" height="43" style="display:block; border:none; outline:none; text-decoration:none;" />
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
                </td>
                </tr>
                </table>
                <![endif]-->
      </td>
    </tr>

  </table>
</body>

</html>`
}
