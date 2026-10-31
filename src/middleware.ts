import { NextRequest, NextResponse } from "next/server";
import { checkPrivateAccess } from "@/lib/private-access";

export async function middleware(request: NextRequest) {
  const denied = await checkPrivateAccess(request);
  if (denied) return denied;
  if (request.method === "DELETE") {
    const kind = request.nextUrl.pathname === "/api/accounts" ? "account" : request.nextUrl.pathname === "/api/journal/trades" ? "trade" : null;
    if (kind) {
      const destination = request.nextUrl.clone();
      destination.pathname = "/api/deletions";
      destination.searchParams.set("kind", kind);
      return NextResponse.rewrite(destination);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
