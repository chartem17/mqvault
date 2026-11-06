"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { defaultDashboardLayout, type DashboardLayout } from "@/lib/dashboard-widgets";
import { readStoredDashboardLayout, sameLayout } from "@/lib/dashboard-layout";

type Snapshot = { layout: DashboardLayout; revision: number };
async function toSnapshot(response: Response): Promise<Snapshot> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || "Помилка розкладки"), { status: response.status });
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) throw new Error("Некоректна ревізія");
  return { layout: readStoredDashboardLayout(body.layout), revision: body.revision };
}

/** Saved arrangement + an editable draft. Nothing is written until `save()` (explicit, like the reference). */
export function useDashboardLayout() {
  const [saved, setSaved] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<DashboardLayout>(defaultDashboardLayout);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const snapshot = await toSnapshot(await fetch("/api/preferences/dashboard-layout", { cache: "no-store", signal }));
      if (!signal?.aborted) { setSaved(snapshot); setDraft(snapshot.layout); setConflict(false); setError(null); }
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Помилка завантаження"); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void reload(controller.signal); return () => controller.abort(); }, [reload]);

  const dirty = saved !== null && !sameLayout(draft, saved.layout);
  const reset = useCallback(() => setDraft(defaultDashboardLayout()), []);
  const cancel = useCallback(() => { if (saved) setDraft(saved.layout); setError(prev => conflict ? prev : null); }, [saved, conflict]);
  const save = useCallback(async (): Promise<boolean> => {
    if (!saved || busy.current) return false;
    busy.current = true; setSaving(true); setError(null);
    try {
      const snapshot = await toSnapshot(await fetch("/api/preferences/dashboard-layout", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layout: draft, expectedRevision: saved.revision }) }));
      setSaved(snapshot); setDraft(snapshot.layout); return true;
    } catch (cause) {
      if (cause && typeof cause === "object" && "status" in cause && cause.status === 409) setConflict(true);
      setError(cause instanceof Error ? cause.message : "Помилка збереження"); return false;
    } finally { busy.current = false; setSaving(false); }
  }, [draft, saved]);

  return { layout: draft, setLayout: setDraft, dirty, loading, saving, conflict, error, ready: saved !== null, reset, cancel, save, reload: () => reload() };
}
