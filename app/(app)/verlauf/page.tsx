'use client';
import { useEffect, useMemo, useState } from 'react';
import WorkoutCard, { type Workout } from '@/components/WorkoutCard';
import CalendarView from '@/components/CalendarView';
import StatsView from '@/components/StatsView';
import { addDays, api, fmtDate, todayISO } from '@/lib/format';

type View = 'liste' | 'kalender' | 'auswertung';
const KEY = 'tl_history_view';

export default function Verlauf() {
  const [data, setData] = useState<Workout[] | null>(null);
  const [view, setViewState] = useState<View>('liste');

  useEffect(() => {
    try { const v = localStorage.getItem(KEY) as View | null; if (v) setViewState(v); } catch {}
    api<Workout[]>('/api/workouts').then(setData).catch(() => setData([]));
  }, []);
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(KEY, v); } catch {} };

  const stats = useMemo(() => {
    if (!data) return null;
    const t = todayISO();
    const d30 = addDays(t, -30), d56 = addDays(t, -56);
    return {
      total: data.length,
      last30: data.filter((w) => w.date > d30 && w.date <= t).length,
      perWeek: (data.filter((w) => w.date > d56 && w.date <= t).length / 8).toFixed(1).replace('.', ','),
    };
  }, [data]);

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
      {data && view === 'kalender' && <CalendarView workouts={data} />}
      {data && view === 'auswertung' && <StatsView workouts={data} />}
      {data && view === 'liste' && (
        <>
          {stats && (
            <div className="stats">
              <div className="stat"><b>{stats.total}</b><span>Trainings</span></div>
              <div className="stat"><b>{stats.last30}</b><span>letzte 30 Tage</span></div>
              <div className="stat"><b>{stats.perWeek}</b><span>pro Woche (8 W.)</span></div>
            </div>
          )}
          {data.length === 0 && <p className="muted">Noch keine Trainings erfasst.</p>}
          {data.map((w) => {
            const m = fmtDate(w.date, { month: 'long', year: 'numeric' });
            const head = m !== month ? ((month = m), <div className="month">{m}</div>) : null;
            return <div key={w.date}>{head}<WorkoutCard w={w} /></div>;
          })}
        </>
      )}
    </>
  );
}
