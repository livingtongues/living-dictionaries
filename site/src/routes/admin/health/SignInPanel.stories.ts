import type { SignInHealth } from '$lib/db/server/log-analytics'
import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SignInPanel.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 900, height: 400 }],
}

/**
 * `google_dies_on` is the day Google stops logging anyone in — set it inside the
 * window to reproduce the 2026-07-04 outage, or past the end for a healthy site.
 */
function build({ google_dies_on = 99, days = 14 }: { google_dies_on?: number, days?: number } = {}): SignInHealth {
  const end = new Date('2026-06-23T00:00:00.000Z')
  const daily: SignInHealth['daily'] = []
  for (let index = 0; index < days; index++) {
    const day = new Date(end.getTime() - (days - index) * 86_400_000).toISOString().slice(0, 10)
    const google = index >= google_dies_on ? 0 : 7 + (index % 6)
    const email = 3 + (index % 4)
    daily.push({ day, total: google + email, new_accounts: index % 4 === 0 ? 2 : 0, methods: { google, email } })
  }
  const judged = daily[daily.length - 1]
  const down = judged.methods.google === 0
  return {
    day: judged.day,
    logins: judged.total,
    new_accounts: judged.new_accounts,
    methods: [
      { method: 'email', logins: judged.methods.email, active_days_before: 7, daily_average_before: 4.4, last_login_at: `${judged.day}T21:40:00.000Z`, flatlined: false },
      { method: 'google', logins: judged.methods.google, active_days_before: down ? 5 : 7, daily_average_before: 9.7, last_login_at: `${daily[Math.min(daily.length - 1, Math.max(0, google_dies_on - 1))].day}T18:02:00.000Z`, flatlined: down },
    ].sort((first, second) => second.logins - first.logins),
    daily,
    flatlined: down ? ['google'] : [],
  }
}

/** The alarm state — Google silent for a day after a week of carrying the site. */
export const Flatlined: Story<typeof Component> = {
  props: { sign_in: build({ google_dies_on: 9 }) },
}

/** The everyday state: both methods working, nothing shouted. */
export const Healthy: Story<typeof Component> = {
  props: { sign_in: build() },
}

/** A brand-new install, or a window with no logins at all. */
export const NoLogins: Story<typeof Component> = {
  viewports: [{ width: 900, height: 140 }],
  props: { sign_in: { day: '2026-06-22', logins: 0, new_accounts: 0, methods: [], daily: [], flatlined: [] } },
}
