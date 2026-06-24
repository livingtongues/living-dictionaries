/**
 * Liveness/readiness probe for blue-green deploys. Caddy active health checks hit
 * this every few seconds and route live traffic only to a 200-returning container;
 * the deploy script gates the rollout on it (never tears down the primary until the
 * standby answers here). Returns 200 as soon as the Node server accepts requests —
 * which, because `hooks.server.ts` opens `shared.db` at module load, also implies
 * the DB opened cleanly. Public + unauthenticated by design; carries no data.
 */
export function GET() {
  return new Response('ok', { headers: { 'cache-control': 'no-store' } })
}
