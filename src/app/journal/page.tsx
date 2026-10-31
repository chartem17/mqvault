import { redirect } from "next/navigation";
import { journalAliasDestination } from "@/lib/journal-focus";
export const dynamic = "force-dynamic";
export default async function JournalAlias({ searchParams }: { searchParams: Promise<{ focusTradeIds?: string | string[] }> }) {
  const search = await searchParams;
  redirect(journalAliasDestination(search.focusTradeIds));
}
