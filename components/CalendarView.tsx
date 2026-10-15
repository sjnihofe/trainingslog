'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconLeft, IconRight } from './Icons';
import WorkoutCard, { type Workout } from './WorkoutCard';
import RunCard from './RunCard';
import { useSwipe } from './useSwipe';
import { useCategories } from '@/lib/useCategories';
import { addDays, addMonths, fmtKm, monthEnd, monthName, monthStart, mondayOf, todayISO, type Run } from '@/lib/format';

const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default function CalendarView({ workouts, runs }: { workouts: Workout[]; runs: Run[] }) {
  const router = useRouter();
  const today = todayISO();
  const cats = useCategories() ?? [];
  const [month, setMonth] = useState(monthStart(today));
  const byDate = useMemo(() => new Map(workouts.map((w) => [w.date, w])), [workouts]);
  const runDates = useMemo(() => new Set(runs.map((r) => r.date)), [runs]);

  const first = month, last = monthEnd(month);
  const days: string[] = [];
  for (let d = mondayOf(first); d <= last || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  const inMonth = workouts.filter((w) => w.date >= first && w.date <= last);
  const runsInMonth = runs.filter((r) => r.date >= first && r.date <= last);
  const km = runsInMonth.reduce((a, r) => a + r.distance_m, 0);
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  const change = (d: 1 | -1) => { setDir(d); setMonth((m) => addMonths(m, d)); };
  const swipeRef = useSwipe<HTMLDivElement>(change);

  // Krafttrainings und Läufe gemeinsam, neueste zuerst
  const items = [
    ...inMonth.map((w) => ({ date: w.date, key: 'w' + w.date, node: <WorkoutCard key={'w' + w.date} w={w} /> })),
    ...runsInMonth.map((r) => ({ date: r.date, key: 'r' + r.id, node: <RunCard key={'r' + r.id} r={r} /> })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.key.localeCompare(b.key)));

  return (
    <>
      <div className="cal swipe-area" ref={swipeRef}>
        <div className="cal-head">
          <button className="iconbtn" onClick={() => change(-1)} aria-label="Vorheriger Monat"><IconLeft /></button>
          <div style={{ textAlign: 'center' }}>
            <b>{monthName(month, { month: 'long', year: 'numeric' })}</b>
            <div className="faint small tnum">
              {inMonth.length} Kraft{runs.length > 0 && ` · ${runsInMonth.length} ${runsInMonth.length === 1 ? 'Lauf' : 'Läufe'}${km ? ` (${fmtKm(km)})` : ''}`}
            </div>
          </div>
          <button className="iconbtn" onClick={() => change(1)} aria-label="Nächster Monat"><IconRight /></button>
        </div>
        <div key={month} className={`cal-grid ${dir === 1 ? 'enter-right' : dir === -1 ? 'enter-left' : ''}`}>
          {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
          {days.map((d) => {
            const w = byDate.get(d);
            const run = runDates.has(d);
            const dayCats = w ? cats.filter((c) => w.entries.some((e) => e.category_id === c.id)) : [];
            return (
              <button
                key={d}
                className={`cal-day ${d < first || d > last ? 'out' : ''} ${w ? 'has' : run ? 'run-only' : ''} ${d === today ? 'today' : ''}`}
                onClick={() => router.push(`/tag/${d}`)}
                aria-label={d + (w ? ' – Krafttraining' : '') + (run ? ' – Lauf' : '')}
              >
                {Number(d.slice(8))}
                <span className="cal-dots">
                  {dayCats.map((c) => <i key={c.id} style={{ background: c.color }} />)}
                  {w && dayCats.length === 0 && <i style={{ background: 'var(--faint)' }} />}
                </span>
                {run && <span className="cal-run" />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="legend">
        {cats.map((c) => <span key={c.id}><i style={{ background: c.color }} />{c.name}</span>)}
        <span><i className="run-mark" />Laufen</span>
      </div>
      {month !== monthStart(today) && (
        <button className="btn full" style={{ marginBottom: 14 }} onClick={() => setMonth(monthStart(today))}>Zum aktuellen Monat</button>
      )}
      {items.map((i) => i.node)}
    </>
  );
}
