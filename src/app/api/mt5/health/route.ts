import { retiredMt5Response } from "@/lib/market/mt5-retirement";
export const dynamic = "force-dynamic";
export function GET() { return retiredMt5Response("health"); }
