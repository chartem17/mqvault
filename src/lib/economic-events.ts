export type EconomicImpact = "low" | "medium" | "high";
export type EconomicEventStatus = "upcoming" | "released" | "revised" | "cancelled";

export type EconomicAssetBias = "supportive" | "negative" | "mixed";

export type EconomicMarketRead = {
  higher: {
    currencyBias: string;
    summary: string;
    assets: Array<{ symbol: string; bias: EconomicAssetBias }>;
  };
  lower: {
    currencyBias: string;
    summary: string;
    assets: Array<{ symbol: string; bias: EconomicAssetBias }>;
  };
  caveat: string;
};

export type EconomicEvent = {
  id: string;
  provider: "mock" | "trading-economics" | "finnhub";
  providerEventId: string | null;
  title: string;
  category: string | null;
  countryCode: string;
  currency: string;
  impact: EconomicImpact;
  status: EconomicEventStatus;
  scheduledAtUtc: string;
  timezone: string;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  revisedPrevious: number | null;
  actualText: string | null;
  forecastText: string | null;
  previousText: string | null;
  unit: string | null;
  sourceUrl: string | null;
  fetchedAt: string;
  releasedAtUtc: string | null;
  marketRead?: EconomicMarketRead;
};

export type EconomicEventSnapshot = Pick<EconomicEvent, "actual" | "forecast" | "previous" | "revisedPrevious" | "actualText" | "forecastText" | "previousText"> & {
  eventId: string;
  capturedAt: string;
};
