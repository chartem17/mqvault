import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth/current-user";
import { rateLimited, type RateLimit } from "@/lib/auth/auth-api";
import { tradesCsv } from "@/lib/journal/trades-csv";

export const dynamic = "force-dynamic";
const EXPORT_PER_USER: RateLimit = { name: "export-user", windowSeconds: 3600, max: 20 };
const PAGE = 1000;

/**
 * GET ?format=json|csv — a copy of everything the signed-in user owns (Settings → Your data).
 * JSON: profile, accounts, trades, strategies and layouts. CSV: trades only. Scoped by the verified ownerId;
 * shared data (news, instruments) and machine secrets (Bridge keys) are not included.
 */
export async function GET(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const limited = await rateLimited(EXPORT_PER_USER, context.ownerId);
  if (limited) return limited;
  const { db, ownerId } = context;
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";

  const trades: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("journal_trades").select("*").eq("user_id", ownerId).order("opened_at", { ascending: true }).range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: "Could not prepare the export" }, { status: 500 });
    trades.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  const { data: accounts, error: accountsError } = await db.from("accounts").select("*").eq("user_id", ownerId).order("created_at");
  if (accountsError) return NextResponse.json({ error: "Could not prepare the export" }, { status: 500 });
  const stamp = new Date().toISOString().slice(0, 10);
  const headers = (type: string, name: string) => ({ "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" });

  if (format === "csv") {
    const names = new Map((accounts ?? []).map(account => [String(account.id), String(account.name ?? "")]));
    return new NextResponse(`﻿${tradesCsv(trades, names)}`, { headers: headers("text/csv; charset=utf-8", `mqvault-trades-${stamp}.csv`) });
  }
  const [profile, strategies, journalLayout, dashboardLayout, devices] = await Promise.all([
    db.from("app_users").select("email, display_name, timezone, locale, country_code, created_at").eq("id", ownerId).maybeSingle(),
    db.from("strategy_rules").select("*").eq("user_id", ownerId),
    db.from("journal_layout_preferences").select("layout, updated_at").eq("user_id", ownerId).maybeSingle(),
    db.from("dashboard_layout_preferences").select("layout, updated_at").eq("user_id", ownerId).maybeSingle(),
    db.from("bridge_devices").select("name, os, bridge_version, created_at, last_seen_at, revoked_at").eq("user_id", ownerId),
  ]);
  const body = {
    format: "mqvault-export", version: 1, exported_at: new Date().toISOString(),
    profile: profile.data, accounts: accounts ?? [], trades, strategies: strategies.data ?? [],
    layouts: { journal: journalLayout.data?.layout ?? null, dashboard: dashboardLayout.data?.layout ?? null },
    bridge_devices: devices.data ?? [],
  };
  return new NextResponse(JSON.stringify(body, null, 2), { headers: headers("application/json; charset=utf-8", `mqvault-export-${stamp}.json`) });
}
