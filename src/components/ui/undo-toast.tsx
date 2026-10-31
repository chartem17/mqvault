"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Options = { key: string; message: string; onUndo: () => void; onCommit: () => void | Promise<void>; duration?: number };
type Item = Options & { id: number; duration: number; state: "pending" | "saving" | "error" };
const Context = createContext<{ notify: (options: Options) => boolean } | null>(null);

export function UndoProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const sequence = useRef(0);
  const tasks = useRef(new Map<number, { item: Item; timer: ReturnType<typeof setTimeout> }>());
  const keys = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const activeTasks = tasks.current;
    const activeKeys = keys.current;
    return () => { mounted.current = false; activeTasks.forEach(task => clearTimeout(task.timer)); activeTasks.clear(); activeKeys.clear(); };
  }, []);
  const remove = useCallback((id: number) => { if (mounted.current) setItems(current => current.filter(item => item.id !== id)); }, []);
  const notify = useCallback((options: Options) => {
    if (keys.current.has(options.key)) return false;
    keys.current.add(options.key);
    const item: Item = { ...options, id: ++sequence.current, duration: options.duration ?? 10000, state: "pending" };
    setItems(current => [...current, item]);
    const timer = setTimeout(async () => {
      tasks.current.delete(item.id);
      if (mounted.current) setItems(current => current.map(value => value.id === item.id ? { ...value, state: "saving" } : value));
      try { await item.onCommit(); remove(item.id); }
      catch {
        try { item.onUndo(); } catch { /* Keep the error visible if local rollback fails. */ }
        if (mounted.current) setItems(current => current.map(value => value.id === item.id ? { ...value, state: "error" } : value));
      } finally { keys.current.delete(item.key); }
    }, item.duration);
    tasks.current.set(item.id, { item, timer });
    return true;
  }, [remove]);
  function undo(item: Item) {
    const task = tasks.current.get(item.id);
    if (!task) return;
    clearTimeout(task.timer); tasks.current.delete(item.id); keys.current.delete(item.key);
    try { item.onUndo(); remove(item.id); } catch { setItems(current => current.map(value => value.id === item.id ? { ...value, state: "error" } : value)); }
  }
  return <Context.Provider value={{ notify }}>
    {children}
    {items.length > 0 && typeof document !== "undefined" ? createPortal(<aside aria-label="Скасування видалення" className="fixed bottom-4 right-4 z-[90] flex max-h-[70dvh] w-[min(400px,calc(100vw-2rem))] flex-col gap-2 overflow-y-auto">
      <style>{`@keyframes undoCountdown { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 100; } } @keyframes undoAppear { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @media (prefers-reduced-motion: reduce) { .undo-notice, .undo-countdown { animation: none !important; } }`}</style>
      {items.map(item => <div key={item.id} className="undo-notice flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-foreground shadow-xl" style={{ animation: "undoAppear 180ms ease-out" }}>
        <p role="status" className="min-w-0 flex-1 break-words text-sm">{item.state === "error" ? "Не вдалося підтвердити видалення. Перевірте стан даних після оновлення." : item.message}{item.state === "saving" ? " · Зберігаємо…" : null}</p>
        {item.state === "pending" ? <button type="button" onClick={() => undo(item)} className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary hover:bg-secondary focus-visible:outline focus-visible:outline-2 active:opacity-80"><svg viewBox="0 0 24 24" className="h-5 w-5 -rotate-90" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" opacity="0.2" strokeWidth="2" /><circle className="undo-countdown" cx="12" cy="12" r="10" pathLength="100" strokeDasharray="100" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: `undoCountdown ${item.duration}ms linear forwards` }} /></svg>Скасувати</button> : item.state === "error" ? <button type="button" onClick={() => remove(item.id)} className="min-h-11 rounded-lg px-2 text-sm hover:bg-secondary">Закрити</button> : null}
      </div>)}
    </aside>, document.body) : null}
  </Context.Provider>;
}

export function useUndo() { const value = useContext(Context); if (!value) throw new Error("useUndo requires UndoProvider"); return value; }
