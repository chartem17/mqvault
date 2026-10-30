export const LOCAL_MT5_RETIRED_MESSAGE = "Локальний MT5 bridge більше не підтримується. Рахунки та угоди залишаються в журналі; автоматичну синхронізацію не підключено.";
export function retiredMt5Response(kind: "health" | "history" | "positions"): Response {
  if (!["health", "history", "positions"].includes(kind)) throw new Error("Invalid retired MT5 endpoint");
  const body = { connected: false, code: "local_bridge_retired", error: LOCAL_MT5_RETIRED_MESSAGE, ...(kind === "history" ? { deals: [], positions: [], initialDeposit: null, updatedAt: null } : kind === "positions" ? { positions: [], updatedAt: null } : {}) };
  return new Response(JSON.stringify(body), { status: 410, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
