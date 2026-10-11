'use client';
import { useMemo, useState } from 'react';
import { IconLeft, IconRight } from './Icons';
import WorkoutCard, { type Workout } from './WorkoutCard';
import RunCard from './RunCard';
import { useSwipe } from './useSwipe';
import { addDays, addMonths, daysBetween, fmtDuration, fmtKm, fmtPace, isoWeek, monthEnd, monthName, monthStart, mondayOf, num, todayISO, type Run } from '@/lib/format';

type Mode = 'monat' | 'quartal' | 'jahr';
type Bucket = { key: string; label: string; from: string; to: string; kraft: number; lauf: number; km: number; current: boolean };

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

function bucketsOf(mode: Mode, from: string, to: string, today: string) {
  const out: { key: string; label: string; from: string; to: string; current: boolean }[] = [];
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
const inRange = (d: string, f: string, t: string) => d >= f && d <= t;

export default function StatsView({ workouts, runs }: { workouts: Workout[]; runs: Run[] }) {
  const today = todayISO();
  const [mode, setMode] = useState<Mode>('monat');
  const [anchor, setAnchor] = useState(today);
  const [sel, setSel] = useState<string | null>(null);
  const hasRuns = runs.length > 0;

  const { from, to, title } = periodOf(mode, anchor);
  const prev = periodOf(mode, addMonths(anchor, -STEP[mode]));
  const wIn = useMemo(() => workouts.filter((w) => inRange(w.date, from, to)), [workouts, from, to]);
  const rIn = useMemo(() => runs.filter((r) => inRange(r.date, from, to)), [runs, from, to]);
  const prevKraft = workouts.filter((w) => inRange(w.date, prev.from, prev.to)).length;
  const prevKm = runs.filter((r) => inRange(r.date, prev.from, prev.to)).reduce((a, r) => a + r.distance_m, 0);

  const buckets: Bucket[] = bucketsOf(mode, from, to, today).map((b) => {
    const rs = rIn.filter((r) => inRange(r.date, b.from, b.to));
    return { ...b, kraft: wIn.filter((w) => inRange(w.date, b.from, b.to)).length, lauf: rs.length, km: rs.reduce((a, r) => a + r.distance_m, 0) };
  });
  const selected = buckets.find((b) => b.key === sel) ?? null;
  const lf = selected?.from ?? from, lt = selected?.to ?? to;

  const end = to > today && from <= today ? today : to;
  const weeks = Math.max(1, (daysBetween(from, end) + 1) / 7);
  const perWeek = from > today ? 0 : wIn.length / weeks;
  const diff = wIn.length - prevKraft;
  const km = rIn.reduce((a, r) => a + r.distance_m, 0);
  const sec = rIn.reduce((a, r) => a + r.moving_time_s, 0);
  const kmDiff = (km - prevKm) / 1000;

  const go = (dir: number) => { setAnchor(addMonths(anchor, dir * STEP[mode])); setSel(null); };
  const switchMode = (m: Mode) => { setMode(m); setSel(null); };
  const swipeRef = useSwipe<HTMLDivElement>((d) => go(d));

  // Gruppiertes Balkendiagramm: Kraft (orange) + Lauf (blau)
  const W = 340, H = 180, T = 22, B = 24;
  const series = hasRuns ? 2 : 1;
  const groupGap = mode === 'monat' ? 12 : 20, inner = 2;
  const gw = (W - groupGap * (buckets.length - 1)) / buckets.length;
  const bw = (gw - inner * (series - 1)) / series;
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.kraft, hasRuns ? b.lauf : 0)));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const bar = (x: number, v: number, color: string) => {
    if (!v) return null;
    const top = y(v), r = Math.min(4, bw / 2);
    return <path d={`M${x},${H - B} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - B} Z`} fill={color} />;
  };

  const items = [
    ...wIn.filter((w) => inRange(w.date, lf, lt)).map((w) => ({ date: w.date, key: 'w' + w.date, node: <WorkoutCard key={'w' + w.date} w={w} /> })),
    ...rIn.filter((r) => inRange(r.date, lf, lt)).map((r) => ({ date: r.date, key: 'r' + r.id, node: <RunCard key={'r' + r.id} r={r} /> })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.key.localeCompare(b.key)));

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

        <div className="stats-label"><i style={{ background: 'var(--c-kraft)' }} />Kraft</div>
        <div className="stats">
          <div className="stat"><b>{wIn.length}</b><span>Trainings</span></div>
          <div className="stat"><b>{num(Math.round(perWeek * 10) / 10)}</b><span>Ø pro Woche</span></div>
          <div className="stat"><b style={{ color: diff > 0 ? 'var(--ok)' : diff < 0 ? 'var(--danger)' : undefined }}>{diff > 0 ? '+' : ''}{diff}</b><span>vs. {prev.title}</span></div>
        </div>
        {hasRuns && (
          <>
            <div className="stats-label"><i style={{ background: 'var(--c-run)' }} />Laufen</div>
            <div className="stats">
              <div className="stat"><b>{fmtKm(km).replace(' km', '')}</b><span>km · {rIn.length} {rIn.length === 1 ? 'Lauf' : 'Läufe'}</span></div>
              <div className="stat"><b>{sec ? fmtDuration(sec) : '–'}</b><span>Zeit · Ø {km ? fmtPace(sec, km) : '–'}</span></div>
              <div className="stat"><b style={{ color: kmDiff > 0.05 ? 'var(--ok)' : kmDiff < -0.05 ? 'var(--danger)' : undefined }}>{kmDiff > 0 ? '+' : ''}{num(Math.round(kmDiff * 10) / 10)}</b><span>km vs. {prev.title}</span></div>
            </div>
          </>
        )}

        <div className="bars">
          <div className="bars-caption">Einheiten {SUB[mode]} · Balken antippen zum Filtern</div>
          {hasRuns && (
            <div className="legend" style={{ margin: '6px 0 2px' }}>
              <span><i className="kraft-mark" style={{ background: 'var(--c-kraft)' }} />Kraft</span>
              <span><i className="lauf-mark" style={{ background: 'var(--c-run)' }} />Laufen</span>
            </div>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Einheiten ${SUB[mode]} in ${title}`}>
            <line x1={0} x2={W} y1={H - B} y2={H - B} stroke="var(--line)" strokeWidth="1" />
            {buckets.map((b, i) => {
              const x = i * (gw + groupGap);
              const active = sel === null || sel === b.key;
              const tip = `${b.label}: ${b.kraft} Kraft` + (hasRuns ? `, ${b.lauf} ${b.lauf === 1 ? 'Lauf' : 'Läufe'}${b.km ? ` (${fmtKm(b.km)})` : ''}` : '');
              return (
                <g key={b.key} className="bar" onClick={() => setSel(sel === b.key ? null : b.key)} opacity={active ? 1 : 0.35}>
                  <title>{tip}</title>
                  <rect x={x} y={0} width={gw} height={H} fill="transparent" />
                  {bar(x, b.kraft, 'var(--c-kraft)')}
                  {hasRuns && bar(x + bw + inner, b.lauf, 'var(--c-run)')}
                  <text x={x + bw / 2} y={y(b.kraft) - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill={b.kraft ? 'var(--text)' : 'var(--faint)'} className="tnum">{b.kraft}</text>
                  {hasRuns && <text x={x + bw + inner + bw / 2} y={y(b.lauf) - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill={b.lauf ? 'var(--text)' : 'var(--faint)'} className="tnum">{b.lauf}</text>}
                  <text x={x + gw / 2} y={H - 7} textAnchor="middle" fontSize="11" fontWeight={b.current ? 800 : 500} fill={b.current ? 'var(--text)' : 'var(--faint)'}>{b.label}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="row" style={{ margin: '18px 4px 8px' }}>
        <span className="label" style={{ margin: 0 }}>{selected ? `Einheiten · ${selected.label}` : `Einheiten · ${title}`}</span>
        {selected && <button className="faint small" style={{ marginLeft: 'auto' }} onClick={() => setSel(null)}>Filter aufheben ✕</button>}
      </div>
      {items.length === 0 && <p className="muted small" style={{ margin: '0 4px' }}>Keine Einheiten in diesem Zeitraum.</p>}
      {items.map((i) => i.node)}
    </>
  );
}
