import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { is_bot_or_unknown_user_agent, is_bot_user_agent } from './bot-user-agent'

/**
 * Cross-repo drift guard for the fleet-canonical robot classifier.
 *
 * `bot-user-agent.ts` is ONE implementation adopted VERBATIM by house, LD and
 * tutor (Jacob, 2026-07-27 — this overrides the earlier "each repo keeps its own
 * matcher" position). It is a copy, not a package, for the same reason the OPFS
 * worker harness is (`$lib/db/worker/PARITY.md` in house) — so this test is what
 * tells a future agent the copies have drifted, without hand-diffing.
 *
 * Same shape as house's `parity.test.ts`: the sibling repos live beside this one
 * under `~/code`, and the cross-repo checks SKIP GRACEFULLY when a sibling isn't
 * checked out (Docker build, CI) so they can never break a build.
 *
 * The behavioural assertions below are NOT skippable — they are the contract that
 * matters most, because LD's `is_bot_request` gate turns a false positive into a
 * BLANK APPLICATION (null dict session → no worker → no offline database).
 */

const THIS_DIR = dirname(fileURLToPath(import.meta.url))
const CANONICAL_FILE = resolve(THIS_DIR, 'bot-user-agent.ts')
// utils → lib → src → site → living-dictionaries → ~/code
const REPOS_DIR = resolve(THIS_DIR, '../../../../..')

/** Every repo that must carry a byte-identical copy, by repo-root name. */
const SIBLING_REPOS = ['house', 'tutor'] as const

const sibling_path = (repo: string) => resolve(REPOS_DIR, repo, 'site/src/lib/utils/bot-user-agent.ts')

describe('canonical robot classifier — cross-repo parity', () => {
  for (const repo of SIBLING_REPOS) {
    const path = sibling_path(repo)
    const present = existsSync(path)

    test.skipIf(!present)(`${repo}'s copy is byte-identical`, () => {
      // Drifted? Do NOT hand-merge: pick the correct version, copy the WHOLE file
      // both ways, and make sure both repos' tests still pass. The file is
      // deliberately app-agnostic — nothing in it should ever need to differ.
      expect(readFileSync(path, 'utf8')).toBe(readFileSync(CANONICAL_FILE, 'utf8'))
    })
  }

  test('at least documents where the copies live when the siblings are absent', () => {
    // Not an assertion about other repos — just keeps the manifest honest so the
    // skipped checks above name real paths when a repo IS checked out.
    expect(SIBLING_REPOS.map(sibling_path).every(path => path.endsWith('/site/src/lib/utils/bot-user-agent.ts'))).toBeTruthy()
  })
})

/**
 * The missing-User-Agent contract. The module exports two functions with
 * IDENTICAL signatures and deliberately OPPOSITE missing-UA policy; LD's boot
 * gate must use the first. If a future "cleanup" collapses them into one, or
 * flips a default, this fails before it reaches a person's phone.
 */
describe('the two exports keep their opposite missing-UA policy', () => {
  test('is_bot_user_agent: a missing UA is NOT a robot (LD\'s boot gate depends on this)', () => {
    expect(is_bot_user_agent(null)).toBeFalsy()
    expect(is_bot_user_agent(undefined)).toBeFalsy()
    expect(is_bot_user_agent('')).toBeFalsy()
  })

  test('is_bot_or_unknown_user_agent: a missing UA IS a robot (house\'s fail-closed warm-up gate)', () => {
    expect(is_bot_or_unknown_user_agent(null)).toBeTruthy()
    expect(is_bot_or_unknown_user_agent(undefined)).toBeTruthy()
    expect(is_bot_or_unknown_user_agent('')).toBeTruthy()
  })
})

/**
 * The precision that was endorsed — pinned here as well as in the copied file's
 * own in-source tests, so the guarantee survives even a wholesale re-copy that
 * loses them.
 */
describe('precision rules the endorsement named', () => {
  test('(a) the generic markers need a word boundary', () => {
    expect(is_bot_user_agent('Mozilla/5.0 (Windows NT 10.0) BotanicalReader/2.0')).toBeFalsy()
    expect(is_bot_user_agent('Mozilla/5.0 (compatible; SomeNewBot/1.0; +http://example.com/bot)')).toBeTruthy()
  })

  test('(b) a device brand containing a marker is stripped before the generic test', () => {
    expect(is_bot_user_agent('Mozilla/5.0 (Linux; Android 12; CUBOT NOTE 20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Mobile Safari/537.36')).toBeFalsy()
  })

  test('(c) the whatsapp marker only counts without a browser token', () => {
    expect(is_bot_user_agent('Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.6.78')).toBeFalsy()
    expect(is_bot_user_agent('WhatsApp/2.19.81 A')).toBeTruthy()
  })

  test('and the real crawlers are still caught', () => {
    expect(is_bot_user_agent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBeTruthy()
    expect(is_bot_user_agent('Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)')).toBeTruthy()
    expect(is_bot_user_agent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.0.0 Safari/537.36')).toBeTruthy()
  })
})
