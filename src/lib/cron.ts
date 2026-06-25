import { env } from "@/lib/env";

/**
 * Authorize a cron request. Accepts `Authorization: Bearer <CRON_SECRET>`
 * (used by Vercel Cron) or `?secret=<CRON_SECRET>` for manual triggers.
 */
export function isCronAuthorized(req: Request): boolean {
  const header = req.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const secret = new URL(req.url).searchParams.get("secret") ?? undefined;
  return bearer === env.cronSecret || secret === env.cronSecret;
}
