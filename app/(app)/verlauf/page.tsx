'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { addDays, api, CAT_COLOR, fmtDate, fmtSets, todayISO, type WSet } from '@/lib/format';

type W = { date: string; note: string | null; entries: { name: string; category: string; sets: WSet[] }[] };

export default function Verlauf() {
  const [data, setData] = useState<W[] | null>(null);
  useEffect(() => { api<W[]>('/api/workouts').then(setData).catch(() => setData([])); }, []);

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
      {stats && (
        <div className="stats">
          <div className="stat"><b>{stats.total}</b><span>Trainings</span></div>
          <div className="stat"><b>{stats.last30}</b><span>letzte 30 Tage</span></div>
          <div className="stat"><b>{stats.perWeek}</b><span>pro Woche (8 W.)</span></div>
        </div>
      )}
      {!data && [0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 96 }} />)}
      {data?.length === 0 && <p className="muted">Noch keine Trainings erfasst.</p>}
      {data?.map((w) => {
        const m = fmtDate(w.date, { month: 'long', year: 'numeric' });
        const head = m !== month ? ((month = m), <div className="month">{m}</div>) : null;
        return (
          <div key={w.date}>
            {head}
            <Link href={`/tag/${w.date}`} className="card">
              <div className="row" style={{ marginBottom: 6 }}>
                <b>{fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
                <span className="faint small" style={{ marginLeft: 'auto' }}>{w.entries.length} Übungen</span>
              </div>
              {w.entries.map((e, i) => (
                <div key={i} className="line-item">
                  <span className="dot" style={{ background: CAT_COLOR[e.category] }} />
                  <span>{e.name}</span>
                  <span className="muted tnum" style={{ marginLeft: 'auto', textAlign: 'right' }}>{fmtSets(e.sets)}</span>
                </div>
              ))}
              {w.note && <div className="muted small" style={{ marginTop: 4 }}>{w.note}</div>}
            </Link>
          </div>
        );
      })}
    </>
  );
}
