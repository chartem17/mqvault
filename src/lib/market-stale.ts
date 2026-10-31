type StaleCandidate = { price: number | null; error?: string; stale?: boolean };

// Last-known quotes served after a provider failure must not look healthy.
// Quotes that never had a price keep their own error untouched.
export function markQuotesStale<T extends StaleCandidate>(quotes: T[], reason: string): T[] {
  return quotes.map((quote) => (quote.price === null ? quote : { ...quote, stale: true, error: reason }));
}
