'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconLeft, IconRight } from './Icons';
import WorkoutCard, { type Workout } from './WorkoutCard';
import { useSwipe } from './useSwipe';
import { addDays, addMonths, CAT_COLOR, CATS, monthEnd, monthName, monthStart, mondayOf, todayISO } from '@/lib/format';

const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default function CalendarView({ workouts }: { workouts: Workout[] }) {
  const router = useRouter();
  const today = todayISO();
  const [month, setMonth] = useState(monthStart(today));
  const byDate = useMemo(() => new Map(workouts.map((w) => [w.date, w])), [workouts]);

  const first = month, last = monthEnd(month);
  const days: string[] = [];
  for (let d = mondayOf(first); d <= last || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  const inMonth = workouts.filter((w) => w.date >= first && w.date <= last);
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  const change = (d: 1 | -1) => { setDir(d); setMonth((m) => addMonths(m, d)); };
  const swipeRef = useSwipe<HTMLDivElement>(change);

  return (
    <>
      <div className="cal swipe-area" ref={swipeRef}>
        <div className="cal-head">
          <button className="iconbtn" onClick={() => change(-1)} aria-label="Vorheriger Monat"><IconLeft /></button>
          <div style={{ textAlign: 'center' }}>
            <b>{monthName(month, { month: 'long', year: 'numeric' })}</b>
            <div className="faint small tnum">{inMonth.length} {inMonth.length === 1 ? 'Training' : 'Trainings'}</div>
          </div>
          <button className="iconbtn" onClick={() => change(1)} aria-label="Nächster Monat"><IconRight /></button>
        </div>
        <div key={month} className={`cal-grid ${dir === 1 ? 'enter-right' : dir === -1 ? 'enter-left' : ''}`}>
          {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
          {days.map((d) => {
            const w = byDate.get(d);
            const cats = w ? CATS.filter((c) => w.entries.some((e) => e.category === c)) : [];
            return (
              <button
                key={d}
                className={`cal-day ${d < first || d > last ? 'out' : ''} ${w ? 'has' : ''} ${d === today ? 'today' : ''}`}
                onClick={() => router.push(`/tag/${d}`)}
                aria-label={d + (w ? ' – Training' : '')}
              >
                {Number(d.slice(8))}
                <span className="cal-dots">
                  {cats.map((c) => <i key={c} style={{ background: CAT_COLOR[c] }} />)}
                  {w && cats.length === 0 && <i style={{ background: 'var(--faint)' }} />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="legend">
        {CATS.map((c) => <span key={c}><i style={{ background: CAT_COLOR[c] }} />{c}</span>)}
      </div>
      {month !== monthStart(today) && (
        <button className="btn full" style={{ marginBottom: 14 }} onClick={() => setMonth(monthStart(today))}>Zum aktuellen Monat</button>
      )}
      {[...inMonth].map((w) => <WorkoutCard key={w.date} w={w} />)}
    </>
  );
}
