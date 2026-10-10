'use client';
import { useMemo, useState } from 'react';
import { IconLeft, IconRight } from './Icons';
import WorkoutCard, { type Workout } from './WorkoutCard';
import { useSwipe } from './useSwipe';
import { addDays, addMonths, daysBetween, isoWeek, monthEnd, monthName, monthStart, mondayOf, num, todayISO } from '@/lib/format';

type Mode = 'monat' | 'quartal' | 'jahr';
type Bucket = { key: string; label: string; from: string; to: string; count: number; current: boolean };

function periodOf(mode: Mode, anchor: string) {
  const y = Number(anchor.slice(0, 4)), m = Number(anchor.slice(5, 7));
  if (mode === 'monat') return { from: monthStart(anchor), to: monthEnd(anchor), title: monthName(anchor, { month: 'long', year: 'numeric' }) };
  if (mode === 'quartal') {
    const q = Math.floor((m - 1) / 3);
    const from = `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`;
    return { from, to: monthEnd(addMonths(from, 2)), title: `Q${q + 1} ${y}` };
  }
  return { from: `${y}-01-01`, to: `${y}-12-31`, title: String(y) };
}

function bucketsOf(mode: Mode, from: string, to: string, today: string): Omit<Bucket, 'count'>[] {
  const out: Omit<Bucket, 'count'>[] = [];
  if (mode === 'monat') {
    for (let wk = mondayOf(from); wk <= to; wk = addDays(wk, 7)) {
      const f = wk < from ? from : wk, t = addDays(wk, 6) > to ? to : addDays(wk, 6);
      out.push({ key: wk, label: `KW ${isoWeek(wk)}`, from: f, to: t, current: today >= f && today <= t });
    }
  } else if (mode === 'quartal') {
    for (let mo = from; mo <= to; mo = addMonths(mo, 1)) {
      const t = monthEnd(mo);
      out.push({ key: mo, label: monthName(mo, { month: 'short' }).replace('.', ''), from: mo, to: t, current: today >= mo && today <= t });
    }
  } else {
    for (let q = 0; q < 4; q++) {
      const f = addMonths(from, q * 3), t = monthEnd(addMonths(f, 2));
      out.push({ key: f, label: `Q${q + 1}`, from: f, to: t, current: today >= f && today <= t });
    }
  }
  return out;
}

const SUB: Record<Mode, string> = { monat: 'pro Woche', quartal: 'pro Monat', jahr: 'pro Quartal' };
const STEP: Record<Mode, number> = { monat: 1, quartal: 3, jahr: 12 };

export default function StatsView({ workouts }: { workouts: Workout[] }) {
  const today = todayISO();
  const [mode, setMode] = useState<Mode>('monat');
  const [anchor, setAnchor] = useState(today);
  const [sel, setSel] = useState<string | null>(null);

  const { from, to, title } = periodOf(mode, anchor);
  const prev = periodOf(mode, addMonths(anchor, -STEP[mode]));
  const inPeriod = useMemo(() => workouts.filter((w) => w.date >= from && w.date <= to), [workouts, from, to]);
  const prevCount = workouts.filter((w) => w.date >= prev.from && w.date <= prev.to).length;
  const buckets: Bucket[] = bucketsOf(mode, from, to, today).map((b) => ({ ...b, count: inPeriod.filter((w) => w.date >= b.from && w.date <= b.to).length }));
  const selected = buckets.find((b) => b.key === sel) ?? null;
  const list = selected ? inPeriod.filter((w) => w.date >= selected.from && w.date <= selected.to) : inPeriod;

  // Ø pro Woche: bei laufendem Zeitraum nur bis heute rechnen
  const end = to > today && from <= today ? today : to;
  const weeks = Math.max(1, (daysBetween(from, end) + 1) / 7);
  const perWeek = from > today ? 0 : inPeriod.length / weeks;
  const diff = inPeriod.length - prevCount;

  const go = (dir: number) => { setAnchor(addMonths(anchor, dir * STEP[mode])); setSel(null); };
  const switchMode = (m: Mode) => { setMode(m); setSel(null); };
  const swipeRef = useSwipe<HTMLDivElement>((d) => go(d));

  // Balkendiagramm
  const W = 340, H = 170, T = 20, B = 24, gap = mode === 'monat' ? 10 : 18;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const bw = (W - gap * (buckets.length - 1)) / buckets.length;
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const r = 4;

  return (
    <>
      <div className="seg full">
        {(['monat', 'quartal', 'jahr'] as Mode[]).map((m) => (
          <button key={m} className={mode === m ? 'on' : ''} onClick={() => switchMode(m)}>{m === 'monat' ? 'Monat' : m === 'quartal' ? 'Quartal' : 'Jahr'}</button>
        ))}
      </div>

      <div ref={swipeRef} className="swipe-area">
      <div className="cal-head" style={{ marginBottom: 12 }}>
        <button className="iconbtn" onClick={() => go(-1)} aria-label="Vorheriger Zeitraum"><IconLeft /></button>
        <b style={{ fontSize: 18 }}>{title}</b>
        <button className="iconbtn" onClick={() => go(1)} aria-label="Nächster Zeitraum"><IconRight /></button>
      </div>

      <div className="stats">
        <div className="stat"><b>{inPeriod.length}</b><span>Trainings</span></div>
        <div className="stat"><b>{num(Math.round(perWeek * 10) / 10)}</b><span>Ø pro Woche</span></div>
        <div className="stat"><b style={{ color: diff > 0 ? 'var(--ok)' : diff < 0 ? 'var(--danger)' : undefined }}>{diff > 0 ? '+' : ''}{diff}</b><span>vs. {prev.title}</span></div>
      </div>

      <div className="bars">
        <div className="bars-caption">Trainings {SUB[mode]} · Balken antippen zum Filtern</div>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Trainings ${SUB[mode]} in ${title}`}>
          <line x1={0} x2={W} y1={H - B} y2={H - B} stroke="var(--line)" strokeWidth="1" />
          {buckets.map((b, i) => {
            const x = i * (bw + gap);
            const top = y(b.count), h = H - B - top;
            const active = sel === null || sel === b.key;
            const fill = b.count === 0 ? 'transparent' : 'var(--accent)';
            const path = h > 0
              ? `M${x},${H - B} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - B} Z`
              : '';
            return (
              <g key={b.key} className="bar" onClick={() => setSel(sel === b.key ? null : b.key)} opacity={active ? 1 : 0.35}>
                <rect x={x} y={T - 16} width={bw} height={H - T + 16} fill="transparent" />
                {path && <path d={path} fill={fill} />}
                <text x={x + bw / 2} y={top - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill={b.count ? 'var(--text)' : 'var(--faint)'} className="tnum">{b.count}</text>
                <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize="11" fontWeight={b.current ? 800 : 500} fill={b.current ? 'var(--text)' : 'var(--faint)'}>{b.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      </div>

      <div className="row" style={{ margin: '18px 4px 8px' }}>
        <span className="label" style={{ margin: 0 }}>{selected ? `Trainings · ${selected.label}` : `Trainings · ${title}`}</span>
        {selected && <button className="faint small" style={{ marginLeft: 'auto' }} onClick={() => setSel(null)}>Filter aufheben ✕</button>}
      </div>
      {list.length === 0 && <p className="muted small" style={{ margin: '0 4px' }}>Keine Trainings in diesem Zeitraum.</p>}
      {list.map((w) => <WorkoutCard key={w.date} w={w} />)}
    </>
  );
}
