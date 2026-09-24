export type TradeFinancialInput = {
  result_usd: number;
  gross_result_usd?: number;
  commission_usd?: number;
  swap_usd?: number;
};

export type TradeFinancials = {
  grossResultUsd: number;
  commissionUsd: number;
  swapUsd: number;
  netResultUsd: number;
  totalFeesUsd: number;
};

const finite = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function getTradeFinancials(trade: TradeFinancialInput): TradeFinancials {
  const legacyNet = finite(trade.result_usd);
  const commissionUsd = finite(trade.commission_usd);
  const swapUsd = finite(trade.swap_usd);
  const grossResultUsd = trade.gross_result_usd == null
    ? legacyNet - commissionUsd - swapUsd
    : finite(trade.gross_result_usd);
  const netResultUsd = grossResultUsd + commissionUsd + swapUsd;

  return {
    grossResultUsd,
    commissionUsd,
    swapUsd,
    netResultUsd,
    totalFeesUsd: commissionUsd + swapUsd,
  };
}

export function normalizeTradeFinancials<T extends TradeFinancialInput>(trade: T): T & {
  gross_result_usd: number;
  commission_usd: number;
  swap_usd: number;
  result_usd: number;
} {
  const financials = getTradeFinancials(trade);
  return {
    ...trade,
    gross_result_usd: financials.grossResultUsd,
    commission_usd: financials.commissionUsd,
    swap_usd: financials.swapUsd,
    result_usd: financials.netResultUsd,
  };
}
