import type { NextConfig } from 'next';
import { STATIC_SECURITY_HEADERS } from './src/lib/security/headers';

const nextConfig: NextConfig = {
  // Do not advertise the framework.
  poweredByHeader: false,
  // Security headers on every response, static files included. The CSP with its per-request nonce is set by the middleware.
  async headers() {
    return [{ source: '/:path*', headers: STATIC_SECURITY_HEADERS }];
  },
};
export default nextConfig;
