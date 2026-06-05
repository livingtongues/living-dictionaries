import type { PageLoad } from './$types'

// Re-expose the server load's `{ invite }` through a universal load so this
// route's PageData includes the parent layout's universal data (App.PageData
// declares those as required, which a `+page.server.ts`-only route can't satisfy).
export const load: PageLoad = ({ data }) => data
