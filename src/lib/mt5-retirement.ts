export const LOCAL_MT5_RETIRED_MESSAGE = "The local MT5 bridge is no longer supported. Accounts and trades stay in the journal; automatic sync is not connected.";
export function retiredMt5Response(kind: "health" | "history" | "positions"): Response {
  if (!["health", "history", "positions"].includes(kind)) throw new Error("Invalid retired MT5 endpoint");
  const body = { connected: false, code: "local_bridge_retired", error: LOCAL_MT5_RETIRED_MESSAGE, ...(kind === "history" ? { deals: [], positions: [], initialDeposit: null, updatedAt: null } : kind === "positions" ? { positions: [], updatedAt: null } : {}) };
  return new Response(JSON.stringify(body), { status: 410, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
