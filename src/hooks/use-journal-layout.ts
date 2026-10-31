"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultJournalLayout, parseJournalLayout, type JournalLayout } from '@/lib/journal-layout';
type Snapshot = { layout: JournalLayout; revision: number };
async function responseValue(response: Response): Promise<Snapshot> {
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.error || 'Помилка налаштувань журналу'), { status: response.status });
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) throw new Error('Некоректна ревізія');
  return { layout: parseJournalLayout(body.layout), revision: body.revision };
}
export function useJournalLayout() {
  const [layout, setLayout] = useState(defaultJournalLayout);
  const [saved, setSaved] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const reload = useCallback(async (signal?: AbortSignal) => {
    if (busy.current) return;
    setLoading(true);
    try {
      const value = await responseValue(await fetch('/api/preferences/journal-layout', { cache: 'no-store', signal }));
      if (!signal?.aborted) { setSaved(value); setLayout(value.layout); setConflict(false); setError(null); }
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Помилка завантаження'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void reload(controller.signal); return () => controller.abort(); }, [reload]);
  const canEdit = saved !== null && !loading && !saving && !conflict;
  const dirty = saved !== null && JSON.stringify(layout) !== JSON.stringify(saved.layout);
  function change(next: JournalLayout) { if (canEdit && !busy.current) setLayout(parseJournalLayout(next)); }
  function cancel() { if (saved && !busy.current) { setLayout(saved.layout); if (!conflict) setError(null); } }
  async function save(): Promise<boolean> {
    if (!saved || !canEdit || busy.current) return false;
    if (!dirty) return true;
    busy.current = true; setSaving(true); setError(null);
    try {
      const value = await responseValue(await fetch('/api/preferences/journal-layout', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout, expectedRevision: saved.revision }) }));
      setSaved(value); setLayout(value.layout); return true;
    } catch (cause) {
      if (cause && typeof cause === 'object' && 'status' in cause && cause.status === 409) setConflict(true);
      setError(cause instanceof Error ? cause.message : 'Помилка збереження'); return false;
    } finally { busy.current = false; setSaving(false); }
  }
  return { layout, loading, saving, error, conflict, dirty, canEdit, change, cancel, save, reload };
}
