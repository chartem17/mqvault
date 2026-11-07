import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionToken, safeEqual } from "@/lib/auth/session-token";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const password = process.env.VAULT_ACCESS_PASSWORD;
  if (!password || password.length < 20) return NextResponse.json({ error: "Access is not configured" }, { status: 503 });
  let submitted = "";
  try {
    const body = await request.json() as { password?: unknown };
    if (typeof body.password === "string" && body.password.length <= 512) submitted = body.password;
  } catch { /* treated as wrong password */ }
  if (!(await safeEqual(submitted, password))) {
    await new Promise(resolve => setTimeout(resolve, 800));
    return NextResponse.json({ error: "Wrong password" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(password), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
