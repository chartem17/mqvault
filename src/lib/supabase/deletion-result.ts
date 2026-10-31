export type DeletionResult = { deleted: true; trades_deleted?: number; strategies_deleted?: number };

export function parseDeletionResult(value: unknown): DeletionResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid deletion response");
  const result = value as Record<string, unknown>;
  if (typeof result.deleted !== "boolean") throw new Error("Invalid deletion response");
  if (!result.deleted) throw new Error("Остаточне видалення не підтверджено. Оновіть дані для перевірки стану.");
  const parsed: DeletionResult = { deleted: true };
  for (const key of ["trades_deleted", "strategies_deleted"] as const) {
    const count = result[key];
    if (count === undefined) continue;
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) throw new Error("Invalid deletion count");
    parsed[key] = count;
  }
  return parsed;
}
