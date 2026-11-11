/** Shared plumbing of the /api/auth/* routes (ADR 0017). Server only. */
import { NextResponse } from "next/server";
import { clientIp, hashKey, rateLimited } from "./rate-limit";
import { isEmail } from "./request-guard";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export const tooMany = () => json({ error: "Too many attempts. Try again later." }, 429);

export async function readJson(request: Request, maxLength = 4096): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (text.length > maxLength) return {};
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch { return {}; }
}

export function emailFrom(body: Record<string, unknown>): string | null {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  return isEmail(email) ? email : null;
}

/**
 * Two counters per action: one per caller address and e-mail (guessing one account), one per address (spraying
 * many accounts). Keys are hashes. Returns the pair key so a success can clear it.
 */
export async function limitAuth(request: Request, action: string, email: string, perPair: [number, number], perIp: [number, number]): Promise<{ blocked: boolean; pairKey: string }> {
  const ip = await clientIp(request);
  const pairKey = `auth:${action}:${ip}:${await hashKey(email)}`;
  const blocked = (await rateLimited(`auth:${action}:${ip}`, perIp[0], perIp[1])) || (await rateLimited(pairKey, perPair[0], perPair[1]));
  return { blocked, pairKey };
}

/** Same pause for every refused sign-in, so timing does not tell wrong password from unknown e-mail. */
export const refusalDelay = () => new Promise(resolve => setTimeout(resolve, 500 + Math.floor(Math.random() * 200)));

/** Origin used in links we hand to Supabase (OAuth return address). */
export function siteOrigin(request: Request): string {
  return new URL(process.env.VAULT_SITE_ORIGIN || request.url).origin;
}
