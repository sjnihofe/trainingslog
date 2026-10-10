'use client';
import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ProgressChart, { type Point } from '@/components/ProgressChart';
import { IconLeft } from '@/components/Icons';
import { api, CAT_COLOR, fmtDate, fmtSets, fmtShort, num, type WSet } from '@/lib/format';

type Session = { id: number; date: string; sets: WSet[] };
type Metric = 'top' | 'e1rm' | 'reps' | 'volume';

const LABEL: Record<Metric, string> = { top: 'Top-Gewicht', e1rm: '1RM (geschätzt)', reps: 'Wdh', volume: 'Volumen' };

export default function ExerciseProgress({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ exercise: { name: string; category: string; favorite: boolean }; sessions: Session[] } | null>(null);
  const [metric, setMetric] = useState<Metric | null>(null);
  useEffect(() => { api(`/api/exercises/${id}/history`).then(setData); }, [id]);

  const asc = useMemo(() => (data ? [...data.sessions].reverse() : []), [data]);
  const isBw = asc.length > 0 && asc.every((s) => s.sets.every((x) => x.bodyweight || x.weight === null));
  const m: Metric = metric ?? (isBw ? 'reps' : 'top');

  const points: Point[] = useMemo(() => asc.map((s) => {
    const w = s.sets.map((x) => (x.bodyweight ? 0 : x.weight ?? 0));
    const r = s.sets.map((x) => x.reps ?? 0);
    let value = 0;
    if (m === 'top') value = Math.max(...w);
    if (m === 'reps') value = Math.max(...r);
    if (m === 'e1rm') value = Math.max(...s.sets.map((x) => (x.weight ?? 0) * (1 + (x.reps ?? 1) / 30)));
    if (m === 'volume') value = s.sets.reduce((a, x) => a + (x.weight ?? 0) * (x.reps ?? 0), 0);
    return { date: s.date, value: Math.round(value * 10) / 10 };
  }).filter((p) => p.value > 0), [asc, m]);

  if (!data) return <><div className="skeleton" style={{ height: 40, width: 160 }} /><div className="skeleton" style={{ height: 200 }} /></>;

  const color = CAT_COLOR[data.exercise.category];
  const best = points.length ? points.reduce((a, b) => (b.value >= a.value ? b : a)) : null;
  const first = points[0], last = points[points.length - 1];
  const unit = m === 'reps' ? 'Wdh' : 'kg';
  const metrics: Metric[] = isBw ? ['reps'] : ['top', 'e1rm', 'volume'];

  return (
    <>
      <div className="topbar">
        <Link href="/fortschritt" className="iconbtn" aria-label="Zurück"><IconLeft /></Link>
        <button
          className={`star ${data.exercise.favorite ? 'on' : ''}`}
          style={{ width: 44, height: 44 }}
          aria-label={data.exercise.favorite ? 'Keine Standardübung mehr' : 'Als Standardübung markieren'}
          onClick={async () => {
            const favorite = !data.exercise.favorite;
            setData({ ...data, exercise: { ...data.exercise, favorite } });
            await api(`/api/exercises/${id}`, { method: 'PATCH', body: { favorite } });
          }}
        >★</button>
      </div>
      <div className="row" style={{ marginBottom: 4 }}>
        <span className="cat-dot" style={{ background: color }} />
        <span className="subtitle">{data.exercise.category}</span>
      </div>
      <h1 className="title" style={{ marginBottom: 16 }}>{data.exercise.name}</h1>

      <div className="stats">
        <div className="stat"><b>{best ? num(best.value) : '–'}</b><span>Bestwert {unit}{best ? ` · ${fmtShort(best.date)}` : ''}</span></div>
        <div className="stat"><b>{first && last && points.length > 1 ? `${last.value - first.value >= 0 ? '+' : ''}${num(Math.round((last.value - first.value) * 10) / 10)}` : '–'}</b><span>seit Beginn</span></div>
        <div className="stat"><b>{data.sessions.length}</b><span>Einheiten</span></div>
      </div>

      {metrics.length > 1 && (
        <div className="seg">
          {metrics.map((k) => <button key={k} className={k === m ? 'on' : ''} onClick={() => setMetric(k)}>{LABEL[k]}</button>)}
        </div>
      )}
      <ProgressChart points={points} unit={unit} color={color} />
      {m === 'e1rm' && <p className="faint small" style={{ marginTop: -6 }}>Geschätztes Maximalgewicht für 1 Wdh (Epley-Formel) – macht Einheiten mit unterschiedlichen Wdh vergleichbar.</p>}

      <div className="label">Alle Einheiten</div>
      {data.sessions.map((s) => (
        <Link key={s.id} href={`/tag/${s.date}`} className="card row">
          <span>{fmtDate(s.date, { day: 'numeric', month: 'short', year: '2-digit' })}</span>
          <span className="muted tnum" style={{ marginLeft: 'auto' }}>{fmtSets(s.sets)}</span>
        </Link>
      ))}
    </>
  );
}
