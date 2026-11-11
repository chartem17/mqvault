/**
 * Closed beta (ADR 0017): sections whose data is licensed for the owner's private use only
 * (MT5 economic calendar — ADR 0013; market quotes). The API enforces the same rule with `ownerOnly()`.
 */
export const OWNER_ONLY_TABS: readonly string[] = ["market", "calendar"];
