import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/monitoring/scrub";

/** Error monitoring on the server and in the middleware (package 3); same privacy rules as the browser. */
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? "development",
    // Collect nothing personal (Sentry 11 collects all of this by default); the scrubber below is a second layer.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: { request: { allow: ["user-agent"] }, response: false }, httpBodies: [], urlQueryParams: false },
    tracesSampleRate: 0,
    beforeSend: event => scrubEvent(event),
  });
}

/** Errors thrown while rendering a page or running a route handler. */
export const onRequestError = Sentry.captureRequestError;
