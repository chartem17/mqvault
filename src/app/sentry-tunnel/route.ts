/**
 * Error reports from the browser are posted here and forwarded to Sentry (package 3): the CSP can stay
 * connect-src 'self', ad blockers do not drop them, and only the event payload is forwarded (no cookies).
 * The handler accepts only the project's own DSN.
 */
export { POST } from "@sentry/nextjs/tunnel";
