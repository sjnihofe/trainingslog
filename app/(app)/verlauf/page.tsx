'use client';
import { useEffect, useMemo, useState } from 'react';
import WorkoutCard, { type Workout } from '@/components/WorkoutCard';
import CalendarView from '@/components/CalendarView';
import StatsView from '@/components/StatsView';
import RunCard from '@/components/RunCard';
import { usePendingDelete } from '@/components/usePendingDelete';
import { addDays, api, fmtDate, todayISO, type HealthW, type Run } from '@/lib/format';

type View = 'liste' | 'kalender' | 'auswertung';
const KEY = 'tl_history_view';

export default function Verlauf() {
  const [data, setData] = useState<Workout[] | null>(null);
  const [view, setViewState] = useState<View>('liste');
  const [runs, setRuns] = useState<Run[]>([]);
  const [raw, setRaw] = useState<Workout[] | null>(null);
  const [health, setHealth] = useState<HealthW[]>([]);

  const [toast, setToast] = useState('');
  const reload = () => api<Workout[]>('/api/workouts').then(setRaw).catch(() => {});
  const del = usePendingDelete(reload, setToast);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t); }, [toast]);
  const onRemove = (e: { id?: number; name: string }) => { if (e.id !== undefined) del.remove(e.id, e.name); };
  // Entfernte (noch rückgängig machbare) Übungen ausblenden; leer gewordene Trainings ohne Notiz/Watch ebenso
  const shown = useMemo(() => data?.map((w) => ({ ...w, entries: w.entries.filter((e) => e.id === undefined || !del.ids.has(e.id)) }))
    .filter((w) => w.entries.length || w.note || w.health?.length) ?? null, [data, del.ids]);

  useEffect(() => {
    try { const v = localStorage.getItem(KEY) as View | null; if (v) setViewState(v); } catch {}
    api<Workout[]>('/api/workouts').then(setRaw).catch(() => setRaw([]));
    api<HealthW[]>('/api/health/workouts').then(setHealth).catch(() => {});
    api<Run[]>('/api/runs').then(setRuns).catch(() => {});
  }, []);
  // Watch-Trainings an den Trainingstag hängen; Tage nur mit Watch-Training als eigene Einträge
  useEffect(() => {
    if (!raw) return;
    const byDate = new Map<string, HealthW[]>();
    for (const h of health) if (h.date) byDate.set(h.date, [...(byDate.get(h.date) ?? []), h]);
    const merged = raw.map((w) => ({ ...w, health: byDate.get(w.date) }));
    for (const [date, hs] of byDate) if (!raw.some((w) => w.date === date)) merged.push({ date, note: null, entries: [], health: hs });
    merged.sort((a, b) => (a.date < b.date ? 1 : -1));
    setData(merged);
  }, [raw, health]);
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(KEY, v); } catch {} };

  const stats = useMemo(() => {
    const data = shown;
    if (!data) return null;
    const t = todayISO();
    const d30 = addDays(t, -30), d56 = addDays(t, -56);
    return {
      total: data.length,
      last30: data.filter((w) => w.date > d30 && w.date <= t).length,
      perWeek: (data.filter((w) => w.date > d56 && w.date <= t).length / 8).toFixed(1).replace('.', ','),
    };
  }, [shown]);

  let month = '';
  return (
    <>
      <div className="topbar"><h1 className="title">Verlauf</h1></div>
      <div className="seg full" style={{ marginBottom: 16 }}>
        <button className={view === 'liste' ? 'on' : ''} onClick={() => setView('liste')}>Liste</button>
        <button className={view === 'kalender' ? 'on' : ''} onClick={() => setView('kalender')}>Kalender</button>
        <button className={view === 'auswertung' ? 'on' : ''} onClick={() => setView('auswertung')}>Auswertung</button>
      </div>

      {!data && [0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 96 }} />)}
      {shown && view === 'kalender' && <CalendarView workouts={shown} runs={runs} onRemove={onRemove} />}
      {shown && view === 'auswertung' && <StatsView workouts={shown} runs={runs} />}
      {shown && view === 'liste' && (
        <>
          {stats && (
            <div className="stats">
              <div className="stat"><b>{stats.total}</b><span>Trainings</span></div>
              <div className="stat"><b>{stats.last30}</b><span>letzte 30 Tage</span></div>
              <div className="stat"><b>{stats.perWeek}</b><span>pro Woche (8 W.)</span></div>
            </div>
          )}
          {shown.length === 0 && <p className="muted">Noch keine Trainings erfasst.</p>}
          {[
            ...shown.map((w) => ({ date: w.date, key: 'w' + w.date, node: <WorkoutCard w={w} onRemove={onRemove} /> })),
            ...runs.map((r) => ({ date: r.date, key: 'r' + r.id, node: <RunCard r={r} /> })),
          ]
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.key.localeCompare(b.key)))
            .map((it) => {
              const m = fmtDate(it.date, { month: 'long', year: 'numeric' });
              const head = m !== month ? ((month = m), <div className="month">{m}</div>) : null;
              return <div key={it.key}>{head}{it.node}</div>;
            })}
        </>
      )}
      {del.toast ?? (toast && <div className="toast">{toast}</div>)}
    </>
  );
}
