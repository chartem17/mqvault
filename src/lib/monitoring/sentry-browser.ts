import * as Sentry from "@sentry/nextjs";
import { scrubBreadcrumb, scrubEvent } from "./scrub";

/**
 * Error monitoring in the browser (package 3), loaded after the page is interactive (performance pass
 * 2026-11-26: the SDK is ~290 KB of script that used to be parsed before the first paint of every page).
 * Privacy: no session replay, no performance tracing, no user identity; every report passes the scrubber
 * (lib/monitoring/scrub.ts). Reports go through this site (/sentry-tunnel), so the CSP stays 'self'.
 */
export function startSentry(dsn: string) {
  Sentry.init({
    dsn,
    enabled: true,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    // Collect nothing personal (Sentry 11 collects all of this by default); the scrubber below is a second layer.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: { request: { allow: ["user-agent"] }, response: false }, httpBodies: [], urlQueryParams: false },
    tracesSampleRate: 0,
    beforeSend: event => scrubEvent(event),
    beforeBreadcrumb: crumb => scrubBreadcrumb(crumb),
  });
  return Sentry;
}
