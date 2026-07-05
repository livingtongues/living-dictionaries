import { redirect } from '@sveltejs/kit'

/**
 * Admin-3 preview gate on the corpus routes (texts list/ingest/reader +
 * sentence detail) while the texts-sentences pipeline is iterated on
 * (.issues/texts-sentences-pipeline.md). Nothing changes for non-admins —
 * the routes bounce to the entries page they already know. LIFT AT GA:
 * delete this module and the `+page.ts` guards that call it (the designed
 * permission model is contributor+ for all corpus editing).
 */
export function guard_corpus_preview({ auth_user, dictionary_url }: {
  auth_user: { admin_level?: number } | null | undefined
  dictionary_url: string
}): void {
  if ((auth_user?.admin_level ?? 0) < 3)
    redirect(302, `/${dictionary_url}/entries`)
}
