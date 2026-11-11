import { NextResponse } from "next/server";
import { resolvePrivateOwner } from "@/lib/supabase/private-owner";

export const dynamic = "force-dynamic";

/** GET → who is signed in and which closed-beta sections they may see. */
export async function GET(request: Request) {
  const context = await resolvePrivateOwner(request);
  if (context instanceof Response) return context;
  return NextResponse.json({ email: context.email, isOwner: context.isOwner }, { headers: { "Cache-Control": "no-store" } });
}
