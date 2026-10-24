'use client';
import { useMemo, useRef } from 'react';
import { num } from '@/lib/format';

export type Series = { id: number; name: string; color: string; dash: string; points: { date: string; t: number; v: number }[] };
export type Panel = { key: string; title: string; unit: string; series: Series[]; baseline?: number };

const DAY = 86400_000;

function niceTicks(min: number, max: number, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

const fmtX = (t: number, spanDays: number) =>
  new Date(t).toLocaleDateString('de-DE', spanDays > 200 ? { month: 'short', year: '2-digit', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Mehrere Übungen in einem Diagramm. Je Einheit (kg / Wdh / %) ein eigenes Feld mit eigener Achse –
 * nie zwei Skalen im selben Feld. Antippen/Ziehen wählt den nächstgelegenen Trainingstag.
 */
export default function MultiChart({ panels, from, to, selected, onSelect, focus }: {
  panels: Panel[]; from: number; to: number; selected: string | null; onSelect: (date: string | null) => void; focus: number | null;
}) {
  const W = 340, L = 38, R = 10, H = 170, T = 14, B = 8, XB = 22;
  const span = Math.max(DAY, to - from);
  const x = (t: number) => L + ((t - from) / span) * (W - L - R);
  const ref = useRef<HTMLDivElement>(null);

  // alle sichtbaren Trainingstage (für das Antippen)
  const dates = useMemo(() => {
    const s = new Set<string>();
    panels.forEach((p) => p.series.forEach((se) => se.points.forEach((pt) => pt.t >= from && pt.t <= to && s.add(pt.date))));
    return [...s].map((d) => ({ d, t: Date.parse(d + 'T00:00:00Z') })).sort((a, b) => a.t - b.t);
  }, [panels, from, to]);

  const pick = (clientX: number) => {
    const el = ref.current;
    if (!el || !dates.length) return;
    const r = el.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    const t = from + ((sx - L) / (W - L - R)) * span;
    let best = dates[0];
    for (const d of dates) if (Math.abs(d.t - t) < Math.abs(best.t - t)) best = d;
    onSelect(best.d);
  };

  const ticksX = useMemo(() => {
    const n = 4, out: number[] = [];
    for (let i = 0; i <= n; i++) out.push(from + (span * i) / n);
    return out;
  }, [from, span]);

  const many = panels.reduce((a, p) => a + p.series.length, 0) > 8;
  const selT = selected ? Date.parse(selected + 'T00:00:00Z') : null;

  return (
    <div
      ref={ref}
      className="mchart"
      onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); pick(e.clientX); }}
      onPointerMove={(e) => { if (e.buttons || e.pointerType === 'mouse') pick(e.clientX); }}
    >
      {panels.map((p, pi) => {
        const vis = p.series.map((s) => ({ ...s, pts: s.points.filter((pt) => pt.t >= from && pt.t <= to) })).filter((s) => s.pts.length);
        const vals = vis.flatMap((s) => s.pts.map((pt) => pt.v)).concat(p.baseline !== undefined ? [p.baseline] : []);
        const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
        const y0 = ticks[0], y1 = ticks[ticks.length - 1];
        const last = pi === panels.length - 1;
        const h = H + (last ? XB : 0);
        const y = (v: number) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);
        return (
          <div key={p.key} className="mchart-panel">
            <div className="mchart-title">{p.title}</div>
            <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={p.title}>
              {ticks.map((tk) => (
                <g key={tk}>
                  <line x1={L} x2={W - R} y1={y(tk)} y2={y(tk)} stroke="var(--line)" strokeWidth="1" />
                  <text x={L - 6} y={y(tk) + 4} textAnchor="end" fontSize="10" fill="var(--faint)" className="tnum">{num(tk)}</text>
                </g>
              ))}
              {p.baseline !== undefined && (
                <line x1={L} x2={W - R} y1={y(p.baseline)} y2={y(p.baseline)} stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="3 3" />
              )}
              {selT !== null && selT >= from && selT <= to && (
                <line x1={x(selT)} x2={x(selT)} y1={T - 6} y2={H - B} stroke="var(--text)" strokeOpacity=".35" strokeWidth="1" />
              )}
              {vis.map((s) => {
                const dim = focus !== null && focus !== s.id;
                const strong = focus === s.id;
                const d = s.pts.map((pt, i) => `${i ? 'L' : 'M'}${x(pt.t).toFixed(1)},${y(pt.v).toFixed(1)}`).join(' ');
                return (
                  <g key={s.id} opacity={dim ? 0.18 : 1}>
                    <path d={d} fill="none" stroke={s.color} strokeWidth={strong ? 3 : many ? 1.5 : 2} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />
                    {(!many || strong) && s.pts.map((pt) => (
                      <circle key={pt.date} cx={x(pt.t)} cy={y(pt.v)} r={pt.date === selected ? 4.5 : strong ? 3.2 : 2.4}
                        fill={pt.date === selected ? s.color : 'var(--surface)'} stroke={s.color} strokeWidth="1.6" />
                    ))}
                    {many && !strong && selected && s.pts.filter((pt) => pt.date === selected).map((pt) => (
                      <circle key={pt.date} cx={x(pt.t)} cy={y(pt.v)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth="1.5" />
                    ))}
                  </g>
                );
              })}
              {last && ticksX.map((t, i) => (
                <text key={i} x={x(t)} y={h - 6} fontSize="10" fill="var(--faint)" textAnchor={i === 0 ? 'start' : i === ticksX.length - 1 ? 'end' : 'middle'}>{fmtX(t, span / DAY)}</text>
              ))}
            </svg>
          </div>
        );
      })}
    </div>
  );
}
