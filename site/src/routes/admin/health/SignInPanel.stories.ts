import type { SignInHealth } from '$lib/db/server/log-analytics'
import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SignInPanel.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 900, height: 400 }],
}

function build({ days = 14 }: { days?: number } = {}): SignInHealth {
  const end = new Date('2026-06-23T00:00:00.000Z')
  const daily: SignInHealth['daily'] = []
  for (let index = 0; index < days; index++) {
    const day = new Date(end.getTime() - (days - index) * 86_400_000).toISOString().slice(0, 10)
    const google = 7 + (index % 6)
    const email = 3 + (index % 4)
    daily.push({ day, total: google + email, new_accounts: index % 4 === 0 ? 2 : 0, methods: { google, email } })
  }
  const judged = daily[daily.length - 1]
  return {
    day: judged.day,
    logins: judged.total,
    new_accounts: judged.new_accounts,
    methods: [
      { method: 'email', logins: judged.methods.email },
      { method: 'google', logins: judged.methods.google },
    ].sort((first, second) => second.logins - first.logins),
    daily,
  }
}

/** The everyday state: both methods logging people in. */
export const Healthy: Story<typeof Component> = {
  props: { sign_in: build() },
}

/** A brand-new install, or a window with no logins at all. */
export const NoLogins: Story<typeof Component> = {
  viewports: [{ width: 900, height: 140 }],
  props: { sign_in: { day: '2026-06-22', logins: 0, new_accounts: 0, methods: [], daily: [] } },
}
