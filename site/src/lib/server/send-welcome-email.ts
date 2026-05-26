import { ADMINS } from '$lib/admins'
import { send_email } from '$lib/email/send-email'
import NewUserWelcome from '../../routes/api/email/components/NewUserWelcome.svelte'
import { render_component_to_html } from '../../routes/api/email/render-component-to-html'

/**
 * Fire-and-forget welcome email on first signup. Wraps two SES sends:
 *   1. Welcome email to the new user (LD-specific copy)
 *   2. Heads-up notification to all `ADMINS` so the team knows a new user joined.
 *
 * Callers (`/api/auth/email/verify`, `/api/auth/google`) `void`-await this and
 * log any failure; signup completes even if SES is down.
 */

export interface SendWelcomeEmailParams {
  email: string
  name: string | null
}

export async function send_welcome_email({ email, name }: SendWelcomeEmailParams): Promise<void> {
  const html = render_component_to_html({
    component: NewUserWelcome,
    props: { name },
  })

  // Fallback plain-text so spam filters give us a multipart-deliverability boost.
  const text = `Hello${name ? ` ${name}` : ''} and welcome to the Living Dictionaries community.

Visit https://livingdictionaries.app anytime — bookmark it so you can easily return and continue working on your Living Dictionary project.

The interface is available in over 13 languages (switch in the upper-right corner) and we keep adding more.

Visit Living Tongues to learn more: https://livingtongues.org/

If you have any questions, email Diego at diego@livingtongues.org or reply to this email.

Best wishes,
The Living Tongues team`

  await Promise.allSettled([
    send_email({
      to: [{ email, name: name ?? undefined }],
      subject: 'Welcome to Living Dictionaries',
      body: { html, text },
    }),
    send_email({
      to: ADMINS
        // Don't blast an admin's own welcome notification at themselves.
        .filter(admin => admin.email !== email)
        .map(admin => ({ email: admin.email, name: admin.name })),
      subject: `New Living Dictionaries user: ${email}`,
      type: 'text/plain',
      body: `Hey Admins,

${name || email} has just created a Living Dictionaries account, and we sent them an automatic welcome email.

~ Automatic SveltKit endpoint at /api/auth

https://livingdictionaries.app`,
    }),
  ])
}
