'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Entfernen mit Rückgängig: Die Übung wird sofort ausgeblendet, aber erst nach UNDO_MS wirklich
// gelöscht. Bis dahin bleibt sie unverändert in der Datenbank – "Rückgängig" holt sie also mit
// derselben ID, denselben Sätzen und an derselben Stelle zurück. Verlässt man die Seite vorher,
// wird das Löschen noch abgeschickt (keepalive); stürzt die App ab, bleibt die Übung einfach erhalten.
const UNDO_MS = 6000;

type Pending = { id: number; label: string };

export function usePendingDelete(onCommitted: () => void, onError?: (msg: string) => void) {
  const [pending, setPending] = useState<Pending[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const cb = useRef({ onCommitted, onError });
  cb.current = { onCommitted, onError };

  const commit = useCallback(async (id: number) => {
    timers.current.delete(id);
    try {
      const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error();
    } catch {
      cb.current.onError?.('Entfernen fehlgeschlagen – Übung bleibt erhalten');
    }
    setPending((p) => p.filter((x) => x.id !== id));
    cb.current.onCommitted();
  }, []);

  const remove = useCallback((id: number, label: string) => {
    if (timers.current.has(id)) return;
    setPending((p) => [...p, { id, label }]);
    timers.current.set(id, setTimeout(() => commit(id), UNDO_MS));
  }, [commit]);

  const undo = useCallback(() => {
    for (const t of timers.current.values()) clearTimeout(t);
    timers.current.clear();
    setPending([]);
  }, []);

  // Beim Verlassen der Seite (Tag wechseln, App schließen) noch offene Löschungen abschicken
  useEffect(() => {
    const flush = () => {
      for (const [id, t] of timers.current) {
        clearTimeout(t);
        fetch(`/api/entries/${id}`, { method: 'DELETE', keepalive: true }).catch(() => {});
      }
      timers.current.clear();
    };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, []);

  const ids = useMemo(() => new Set(pending.map((p) => p.id)), [pending]);
  const toast = pending.length ? (
    <div className="toast undo-toast" role="status">
      <span>{pending.length === 1 ? `„${pending[0].label}“ entfernt` : `${pending.length} Übungen entfernt`}</span>
      <button onClick={undo}>Rückgängig</button>
    </div>
  ) : null;

  return { remove, undo, ids, toast };
}
