/**
 * Inbound-email triage constants. See `.issues/ai-triage-pipeline.md`.
 * Ported from house; categories/routing/agent identity are LD-specific.
 */

/** xAI flagship — best reasoning/quality; LD inbound volume makes cost negligible. */
export const GROK_MODEL = 'grok-4.3'

/** Singleton agent system user — seeded in `20260625e_triage.sql`. */
export const AGENT_USER_ID = '5a12e3e0-03eb-489f-a23b-23cc3d2a1c12'
export const AGENT_USER_EMAIL = 'agent@livingdictionaries.app'
export const AGENT_USER_NAME = 'LD Triage'

export const TRIAGE_VERDICTS = ['spam', 'human'] as const
export type TriageVerdict = (typeof TRIAGE_VERDICTS)[number]

/**
 * Human-routable buckets for LD's language-documentation domain:
 *   technical    — site/upload/audio bugs, broken pages, export failures.
 *   content      — dictionary editing, linguistic-data questions, how-to.
 *   account      — login problems, contributor/editor access, invites.
 *   partnership  — orgs / researchers wanting to collaborate.
 *   other        — anything that doesn't fit.
 * (`spam` is a verdict, not a category; `notification` is an auto-resolver
 * marker — neither is in this list.)
 */
export const TRIAGE_CATEGORIES = ['technical', 'content', 'account', 'partnership', 'other'] as const
export type TriageCategory = (typeof TRIAGE_CATEGORIES)[number]

export const TRIAGE_CONFIDENCE = ['high', 'low'] as const
export type TriageConfidence = (typeof TRIAGE_CONFIDENCE)[number]
