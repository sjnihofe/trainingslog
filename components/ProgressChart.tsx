'use client';
import { daysBetween, fmtShort, num } from '@/lib/format';

export type Point = { date: string; value: number };

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export default function ProgressChart({ points, unit, color }: { points: Point[]; unit: string; color: string }) {
  if (points.length === 0) return <div className="chart muted small" style={{ padding: 20 }}>Noch keine Daten.</div>;
  const W = 340, H = 190, L = 36, R = 14, T = 16, B = 26;
  const vals = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const span = Math.max(1, daysBetween(points[0].date, points[points.length - 1].date));
  const x = (d: string) => (points.length === 1 ? L + (W - L - R) / 2 : L + (daysBetween(points[0].date, d) / span) * (W - L - R));
  const y = (v: number) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const maxV = Math.max(...vals);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Fortschrittsdiagramm">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--faint)" className="tnum">{num(t)}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(p.date)} cy={y(p.value)} r={p.value === maxV ? 4 : 2.6} fill={p.value === maxV ? color : 'var(--surface)'} stroke={color} strokeWidth="1.6">
            <title>{`${fmtShort(p.date)}: ${num(p.value)} ${unit}`}</title>
          </circle>
        ))}
        <text x={Math.min(x(last.date), W - R)} y={y(last.value) - 9} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--text)" className="tnum">{num(last.value)} {unit}</text>
        <text x={L} y={H - 6} fontSize="10" fill="var(--faint)">{fmtShort(points[0].date)}</text>
        <text x={W - R} y={H - 6} fontSize="10" fill="var(--faint)" textAnchor="end">{fmtShort(last.date)}</text>
      </svg>
    </div>
  );
}
