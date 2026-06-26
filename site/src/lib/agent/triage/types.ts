import type { TriageCategory, TriageConfidence, TriageVerdict } from './constants'

/**
 * Structured output of the stateless Grok classifier. Drafts/advice are written
 * as if the advised action was already taken, so an admin performs the action
 * then sends/edits the draft (never auto-sent in the MVP).
 */
export interface TriageResult {
  verdict: TriageVerdict
  category: TriageCategory
  confidence: TriageConfidence
  /** One-line summary for the admin inbox. */
  summary: string
  /** Internal admin-facing guidance — what action to take + helpful context. */
  advice: string
  /**
   * Customer-facing draft reply, or null when withheld. Partnership is always
   * withheld (relationship-sensitive — the admin writes it themselves); spam is
   * always withheld.
   */
  draft_reply: string | null
  /** Short note on WHY it's spam/phishing — only meaningful when verdict='spam'. */
  spam_reason: string | null
}
