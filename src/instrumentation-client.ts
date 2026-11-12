import * as Sentry from "@sentry/nextjs";
import { scrubBreadcrumb, scrubEvent } from "@/lib/monitoring/scrub";

/**
 * Error monitoring in the browser (package 3). Off until NEXT_PUBLIC_SENTRY_DSN is set.
 * Privacy: no session replay, no performance tracing, no user identity; every report passes the scrubber
 * (lib/monitoring/scrub.ts). Reports go through this site (/sentry-tunnel), so the CSP stays 'self'.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  // Collect nothing personal (Sentry 11 collects all of this by default); the scrubber below is a second layer.
  dataCollection: { userInfo: false, cookies: false, httpHeaders: { request: { allow: ["user-agent"] }, response: false }, httpBodies: [], urlQueryParams: false },
  tracesSampleRate: 0,
  beforeSend: event => scrubEvent(event),
  beforeBreadcrumb: crumb => scrubBreadcrumb(crumb),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
