/**
 * Privacy filter for error reports (Sentry). Pure, unit-tested. An error report keeps only what is needed to fix
 * the bug: the error, the stack, the page path, browser and release. It never carries cookies, headers other than
 * the browser name, request bodies, query strings, user identity, e-mail addresses or long digit runs
 * (account numbers, tickets). Amounts never reach reports: the app does not put them into error messages.
 */

type Json = Record<string, unknown>;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LONG_DIGITS = /\b\d{6,}\b/g;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g;

export function scrubText(value: string): string {
  return value.replace(JWT, "[token]").replace(EMAIL, "[email]").replace(LONG_DIGITS, "[number]");
}

/** Path only: no query string or fragment (they can carry codes, ids or e-mail addresses). */
export function scrubUrl(value: string): string {
  try {
    const url = new URL(value, "https://x.invalid");
    const path = scrubText(url.pathname);
    return url.origin === "https://x.invalid" ? path : `${url.origin}${path}`;
  } catch { return "[url]"; }
}

function scrubException(exception: unknown) {
  if (!exception || typeof exception !== "object") return;
  const values = (exception as { values?: Json[] }).values;
  for (const item of values ?? []) if (typeof item.value === "string") item.value = scrubText(item.value);
}

/** beforeSend: returns the same event, reduced. */
export function scrubEvent<T extends object>(event: T): T {
  const target = event as unknown as Json;
  delete target.user;
  delete target.extra;
  delete target.server_name;
  const request = target.request as Json | undefined;
  if (request) {
    const userAgent = (request.headers as Json | undefined)?.["User-Agent"] ?? (request.headers as Json | undefined)?.["user-agent"];
    target.request = {
      ...(typeof request.url === "string" ? { url: scrubUrl(request.url) } : {}),
      ...(typeof request.method === "string" ? { method: request.method } : {}),
      ...(typeof userAgent === "string" ? { headers: { "User-Agent": userAgent.slice(0, 300) } } : {}),
    };
  }
  if (typeof target.message === "string") target.message = scrubText(target.message);
  if (typeof target.transaction === "string") target.transaction = scrubUrl(target.transaction);
  scrubException(target.exception);
  const breadcrumbs = target.breadcrumbs as Json[] | undefined;
  if (Array.isArray(breadcrumbs)) target.breadcrumbs = breadcrumbs.map(crumb => scrubBreadcrumb(crumb)).filter(Boolean);
  return event;
}

/** beforeBreadcrumb: navigation and requests keep their path; console text and clicked element text are dropped. */
export function scrubBreadcrumb<T extends object>(crumb: T): T | null {
  const target = crumb as unknown as Json;
  if (target.category === "console" || target.category === "ui.input") return null;
  if (typeof target.message === "string") target.message = target.category === "ui.click" ? "[click]" : scrubText(target.message);
  const data = target.data as Json | undefined;
  if (data) {
    const kept: Json = {};
    for (const key of ["url", "from", "to"]) if (typeof data[key] === "string") kept[key] = scrubUrl(data[key] as string);
    for (const key of ["method", "status_code"]) if (data[key] !== undefined) kept[key] = data[key];
    target.data = kept;
  }
  return crumb;
}
