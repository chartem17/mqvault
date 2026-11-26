/**
 * Browser error monitoring, off until NEXT_PUBLIC_SENTRY_DSN is set. Setup and privacy rules:
 * lib/monitoring/sentry-browser.ts.
 *
 * Performance pass 2026-11-26: the Sentry SDK is no longer part of the first script of every page. It loads when
 * the browser is idle (at most ~4 s after start). Errors thrown before that are kept here and reported once it
 * has loaded, so nothing is lost; only the breadcrumbs of those first seconds are missing.
 */
type SentryModule = ReturnType<typeof import("@/lib/monitoring/sentry-browser").startSentry>;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
let sentry: SentryModule | null = null;

if (dsn && typeof window !== "undefined") {
  const early: unknown[] = [];
  const onError = (event: ErrorEvent) => { if (early.length < 20) early.push(event.error ?? event.message); };
  const onRejection = (event: PromiseRejectionEvent) => { if (early.length < 20) early.push(event.reason); };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  const load = () => {
    import("@/lib/monitoring/sentry-browser")
      .then(({ startSentry }) => {
        sentry = startSentry(dsn);
        window.removeEventListener("error", onError);
        window.removeEventListener("unhandledrejection", onRejection);
        for (const error of early.splice(0)) sentry.captureException(error);
      })
      .catch(() => { /* monitoring must never break the page */ });
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 4000 });
  else setTimeout(load, 1500);
}

export function onRouterTransitionStart(...args: Parameters<SentryModule["captureRouterTransitionStart"]>) {
  sentry?.captureRouterTransitionStart(...args);
}
