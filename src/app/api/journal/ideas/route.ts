import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth/current-user";
import { linkProblem, MAX_IDEA_TRADES, type IdeaTrade } from "@/lib/journal/trade-idea";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS = "id, account_id, symbol, direction, opened_at, meta";
type Row = IdeaTrade & { meta: unknown };

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try { const body = await request.json(); return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null; } catch { return null; }
}
const metaOf = (row: Row): Record<string, unknown> => row.meta && typeof row.meta === "object" && !Array.isArray(row.meta) ? { ...(row.meta as Record<string, unknown>) } : {};
const ideaOf = (row: Row): string | null => { const idea = metaOf(row).idea as { id?: unknown } | undefined; return typeof idea?.id === "string" ? idea.id : null; };

/**
 * POST { trade_ids: uuid[] } — link 2–10 of the user's trades into one idea (ADR 0022). Trades already in an idea
 * bring the rest of that idea along, so ideas merge instead of splitting. Only meta.idea changes; P&L, risk and R of
 * each trade stay as they are.
 */
export async function POST(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const { db, ownerId } = context;
  const body = await readBody(request);
  const ids = Array.isArray(body?.trade_ids) ? [...new Set(body.trade_ids)] : [];
  if (ids.length < 2 || ids.length > MAX_IDEA_TRADES || ids.some(id => typeof id !== "string" || !UUID.test(id))) return json({ error: "Pick 2 to 10 trades" }, 400);

  const { data: picked, error } = await db.from("journal_trades").select(COLUMNS).eq("user_id", ownerId).in("id", ids as string[]);
  if (error) return json({ error: "Could not read the trades" }, 500);
  if (!picked || picked.length !== ids.length) return json({ error: "Trade not found" }, 404);
  const rows = picked as Row[];

  // Existing ideas of the picked trades join in.
  const existing = [...new Set(rows.map(ideaOf).filter((id): id is string => id !== null))];
  let members = rows;
  if (existing.length) {
    const { data: others, error: othersError } = await db.from("journal_trades").select(COLUMNS).eq("user_id", ownerId).in("meta->idea->>id", existing);
    if (othersError) return json({ error: "Could not read the idea" }, 500);
    const byId = new Map([...rows, ...((others ?? []) as Row[])].map(row => [row.id, row]));
    members = [...byId.values()];
  }
  const problem = linkProblem(members);
  if (problem) return json({ error: problem }, 400);

  const ideaId = existing[0] ?? crypto.randomUUID();
  for (const row of members) {
    if (ideaOf(row) === ideaId) continue;
    const { error: updateError } = await db.from("journal_trades").update({ meta: { ...metaOf(row), idea: { id: ideaId } } }).eq("id", row.id).eq("user_id", ownerId);
    if (updateError) return json({ error: "Could not link the trades" }, 500);
  }
  return json({ idea: { id: ideaId }, trade_ids: members.map(row => row.id) });
}

/** DELETE { trade_id } — take one trade out of its idea; an idea left with a single trade dissolves. */
export async function DELETE(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const { db, ownerId } = context;
  const body = await readBody(request);
  const tradeId = body?.trade_id;
  if (typeof tradeId !== "string" || !UUID.test(tradeId)) return json({ error: "trade_id is required" }, 400);

  const { data: row, error } = await db.from("journal_trades").select(COLUMNS).eq("user_id", ownerId).eq("id", tradeId).maybeSingle();
  if (error) return json({ error: "Could not read the trade" }, 500);
  if (!row) return json({ error: "Trade not found" }, 404);
  const ideaId = ideaOf(row as Row);
  if (!ideaId) return json({ success: true });

  const { data: members, error: membersError } = await db.from("journal_trades").select(COLUMNS).eq("user_id", ownerId).eq("meta->idea->>id", ideaId);
  if (membersError) return json({ error: "Could not read the idea" }, 500);
  const remaining = ((members ?? []) as Row[]).filter(member => member.id !== tradeId);
  const release = remaining.length < 2 ? [row as Row, ...remaining] : [row as Row];
  for (const member of release) {
    const meta = metaOf(member);
    delete meta.idea;
    const { error: updateError } = await db.from("journal_trades").update({ meta }).eq("id", member.id).eq("user_id", ownerId);
    if (updateError) return json({ error: "Could not unlink the trade" }, 500);
  }
  return json({ success: true });
}
