import { retiredMt5Response } from "@/lib/mt5-retirement";
export const dynamic = "force-dynamic";
export function GET() { return retiredMt5Response("history"); }
