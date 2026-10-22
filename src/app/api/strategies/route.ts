import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accountId = new URL(req.url).searchParams.get("accountId");
  let q = supabaseAdmin
    .from("strategy_rules")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (accountId && accountId !== "all") q = q.eq("account_id", accountId);

  const { data, error } = await q;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ strategies: data });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json();
  if (!b.account_id || !b.name?.trim())
    return NextResponse.json(
      { error: "account_id and name required" },
      { status: 400 },
    );

  const { data: acc } = await supabaseAdmin
    .from("accounts")
    .select("id")
    .eq("id", b.account_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!acc)
    return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("strategy_rules")
    .insert({
      user_id: user.id,
      account_id: b.account_id,
      name: b.name.trim(),
      description: b.description ?? null,
      market: b.market ?? null,
      definition: b.definition ?? { rules: [] },
      source_strategy_id: b.source_strategy_id ?? null,
    })
    .select()
    .single();
  if (error)
    return NextResponse.json(
      { error: error.message },
      { status: error.code === "23505" ? 409 : 500 },
    );
  return NextResponse.json({ strategy: data }, { status: 201 });
}
