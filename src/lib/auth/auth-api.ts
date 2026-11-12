import { NextResponse } from "next/server";
import { sha256Hex } from "@/lib/bridge/signature";
import { createServerSupabase } from "@/lib/supabase/server";

/** Shared pieces of the /api/auth/* routes (ADR 0017). Error texts are English dictionary keys shown via t(). */

export const authJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function readAuthBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (text.length > 4096) return null;
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

/** The address the e-mail links must return to: the configured origin in production, the request's own otherwise. */
export function siteOrigin(request: Request): string {
  return new URL(process.env.VAULT_SITE_ORIGIN || request.url).origin;
}

export function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

export type RateLimit = { name: string; windowSeconds: number; max: number };
/** Sign-in attempts per IP and per account: slows password guessing without locking an account for long. */
export const LOGIN_PER_IP: RateLimit = { name: "login-ip", windowSeconds: 600, max: 30 };
export const LOGIN_PER_EMAIL: RateLimit = { name: "login-email", windowSeconds: 600, max: 8 };
export const SIGNUP_PER_IP: RateLimit = { name: "signup-ip", windowSeconds: 3600, max: 10 };
/** Each of these sends an e-mail, so they are the tightest. */
export const RESET_PER_IP: RateLimit = { name: "reset-ip", windowSeconds: 3600, max: 10 };
export const RESET_PER_EMAIL: RateLimit = { name: "reset-email", windowSeconds: 3600, max: 3 };
export const PASSWORD_PER_USER: RateLimit = { name: "password-user", windowSeconds: 3600, max: 10 };

/**
 * Counts one attempt. Returns a ready 429/503 response when the caller must stop, null otherwise.
 * Fails closed: if the counter cannot be read, the attempt is refused. Subjects are stored hashed.
 */
export async function rateLimited(limit: RateLimit, subject: string): Promise<Response | null> {
  const db = createServerSupabase();
  const { data, error } = await db.rpc("bridge_rate_limit_hit", { p_key: `auth:${limit.name}:${(await sha256Hex(subject)).slice(0, 40)}`, p_window_seconds: limit.windowSeconds, p_max: limit.max });
  if (error) return authJson({ error: "Service is temporarily unavailable" }, 503);
  if (data !== true) return authJson({ error: "Too many attempts. Try again later." }, 429);
  return null;
}

/** CAPTCHA token from a sign-in form (Cloudflare Turnstile); Supabase Auth verifies it when CAPTCHA is on. */
export function captchaToken(body: Record<string, unknown> | null): string | undefined {
  const value = body?.captchaToken;
  return typeof value === "string" && value.length > 0 && value.length <= 4096 ? value : undefined;
}
