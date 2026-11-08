import { BridgeConnect } from "@/components/settings/bridge-connect";
import { normalizeUserCode } from "@/lib/bridge/pairing";

export const dynamic = "force-dynamic";

/** Behind the private-access middleware: an unauthenticated visit is redirected to /login and back here. */
export default async function BridgeConnectPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const { code } = await searchParams;
  const value = normalizeUserCode(Array.isArray(code) ? code[0] : code);
  return <BridgeConnect initialCode={value ? `${value.slice(0, 4)}-${value.slice(4)}` : ""} />;
}
