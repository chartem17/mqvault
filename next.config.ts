import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';
import { STATIC_SECURITY_HEADERS } from './src/lib/security/headers';

const nextConfig: NextConfig = {
  // Do not advertise the framework.
  poweredByHeader: false,
  // Security headers on every response, static files included. The CSP with its per-request nonce is set by the middleware.
  async headers() {
    return [{ source: '/:path*', headers: STATIC_SECURITY_HEADERS }];
  },
};
// Error monitoring (package 3). Source maps are uploaded only when SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT
// are set in Vercel; without them the build is unchanged and reports show minified stack traces.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  tunnelRoute: '/sentry-tunnel',
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
