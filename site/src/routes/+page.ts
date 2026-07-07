import type { PageLoad } from './$types'

// Pass-through: the server load provides map_dicts + ssr_map; parent (root
// universal layout) data merges automatically. The explicit universal load
// keeps the generated PageData types happy (same quirk as /admin/analytics).
export const load: PageLoad = ({ data }) => data
