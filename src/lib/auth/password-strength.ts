/**
 * Hints for the sign-up and password forms (package 2). Pure; not a security control — the server enforces
 * `passwordProblem` (request-guard.ts) and Supabase Auth its own policy.
 */
import { PASSWORD_MIN_LENGTH } from "./request-guard";

/** 0–4 for the four-segment meter: length and variety, capped for the obvious cases. */
export function passwordStrength(value: string): 0 | 1 | 2 | 3 | 4 {
  if (!value) return 0;
  let score = 0;
  if (value.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (value.length >= 14) score += 1;
  const kinds = [/\p{Ll}/u, /\p{Lu}/u, /\d/, /[^\p{L}\d]/u].filter(pattern => pattern.test(value)).length;
  if (kinds >= 2) score += 1;
  if (kinds >= 3 && value.length >= 12) score += 1;
  if (/^(.)\1+$/.test(value) || /^(?:password|qwerty|123456|111111|letmein)/i.test(value)) score = Math.min(score, 1);
  return Math.max(1, Math.min(4, score)) as 1 | 2 | 3 | 4;
}

/** E-mail one-time codes: digits only; the length follows the Supabase project setting (6 by default). */
export const OTP_LENGTH = 6;
export function normalizeOtp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\s+/g, "");
  return /^\d{6,10}$/.test(digits) ? digits : null;
}
