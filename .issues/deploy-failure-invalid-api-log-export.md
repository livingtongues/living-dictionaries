# Deploy failure: invalid API log export

The 2026-07-31 deploy of `4e6b92ce` failed during SvelteKit's post-build endpoint analysis because
`site/src/routes/api/log/+server.ts` exported `classify_source`. SvelteKit endpoint modules only
permit HTTP handlers, reserved exports, and helper exports prefixed with `_`.

- ✅ Confirmed both existing blue/green containers stayed healthy; rollout never began.
- ✅ Located the exact failure in the webhook service journal and deploy metrics.
- ✅ Renamed the helper export to `_classify_source`, preserving its testable export while making
  it valid for a SvelteKit endpoint module.
- ✅ Endpoint tests pass: 14/14.
- ✅ Full `pnpm --filter=site build` passes, including SvelteKit post-build endpoint analysis.
- 🔄 Commit/push the fix and confirm the follow-up deploy.
