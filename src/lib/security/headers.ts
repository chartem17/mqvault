/**
 * Security headers (package 3). Pure, so the exact policy is unit-tested.
 * CSP uses a per-request nonce with 'strict-dynamic': only scripts that Next.js and next-themes tag with the
 * nonce run; an injected <script> or inline handler does not. Styles allow inline (React style attributes).
 */

/** Sent on every response, static files included (next.config.ts). */
export const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  // Two years, subdomains, eligible for the browser preload list.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Old browsers without frame-ancestors support.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

export function contentSecurityPolicy(nonce: string, options: { dev?: boolean } = {}): string {
  const directives: [string, string][] = [
    ["default-src", "'self'"],
    ["script-src", `'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ""}`],
    ["style-src", "'self' 'unsafe-inline'"],
    // Trade screenshots (TradingView) and provider avatars are https images from other hosts.
    ["img-src", "'self' data: blob: https:"],
    ["font-src", "'self' data:"],
    // The browser talks only to this site; Supabase, brokers and data providers are reached by the server.
    ["connect-src", options.dev ? "'self' ws:" : "'self'"],
    ["frame-src", "'none'"],
    ["frame-ancestors", "'none'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["manifest-src", "'self'"],
    ["worker-src", "'self' blob:"],
  ];
  if (!options.dev) directives.push(["upgrade-insecure-requests", ""]);
  return directives.map(([name, value]) => (value ? `${name} ${value}` : name)).join("; ");
}

/** 128 random bits, base64. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
