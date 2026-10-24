'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, fmtDate, num, todayISO } from '@/lib/format';
import { fitnessTimeline, fitnessTrend, isBodyweight, seriesOf, tOf, toPercent, type Metric, type PExercise } from '@/lib/progress';
import MultiChart, { type Panel, type Series } from '@/components/MultiChart';
import FitnessCard from '@/components/FitnessCard';
import { IconRight } from '@/components/Icons';

type Cat = { id: number; name: string; color: string; position: number };
type Data = { exercises: PExercise[]; categories: Cat[]; activity: string[] };
type Mode = 'abs' | 'pct';
type Range = '3m' | '6m' | '1y' | 'all';
type Saved = { sel?: number[]; mode?: Mode; metric?: Metric; range?: Range };

const KEY = 'tl_progress_v2';
const DASHES = ['', '7 4', '2 4', '11 3 2 3'];
const RANGE_DAYS: Record<Range, number | null> = { '3m': 92, '6m': 183, '1y': 366, all: null };
const METRIC_LABEL: Record<Metric, string> = { top: 'Top-Gewicht', e1rm: '1RM', volume: 'Volumen' };
const DAY = 86400_000;

export default function Fortschritt() {
  const [data, setData] = useState<Data | null>(null);
  const [mode, setMode] = useState<Mode>('abs');
  const [metric, setMetric] = useState<Metric>('top');
  const [range, setRange] = useState<Range>('all');
  const [sel, setSel] = useState<Set<number> | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const today = todayISO();

  useEffect(() => {
    api<Data>('/api/progress').then((d) => {
      setData(d);
      let saved: Saved = {};
      try { saved = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch {}
      if (saved.mode) setMode(saved.mode);
      if (saved.metric) setMetric(saved.metric);
      if (saved.range) setRange(saved.range);
      const ids = new Set(d.exercises.map((e) => e.id));
      if (saved.sel) setSel(new Set(saved.sel.filter((i) => ids.has(i))));
    }).catch(() => setData({ exercises: [], categories: [], activity: [] }));
  }, []);

  // Übungen mit mindestens einer Einheit, sortiert nach Kategorie-Reihenfolge und Häufigkeit
  const withData = useMemo(() => {
    if (!data) return [];
    const pos = new Map(data.categories.map((c) => [c.id, c.position]));
    return data.exercises.filter((e) => e.sessions.length > 0)
      .sort((a, b) => (pos.get(a.category_id) ?? 0) - (pos.get(b.category_id) ?? 0) || b.sessions.length - a.sessions.length);
  }, [data]);

  const defaultSel = useMemo(() => {
    const fav = withData.filter((e) => e.favorite && !e.archived);
    return new Set((fav.length ? fav : [...withData].sort((a, b) => b.sessions.length - a.sessions.length).slice(0, 5)).map((e) => e.id));
  }, [withData]);
  const active = sel ?? defaultSel;

  const persist = (patch: Saved) => {
    try {
      const cur: Saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      localStorage.setItem(KEY, JSON.stringify({ ...cur, ...patch }));
    } catch {}
  };
  const setActive = (s: Set<number>) => { setSel(s); setFocus(null); persist({ sel: [...s] }); };
  const toggle = (id: number) => { const s = new Set(active); s.has(id) ? s.delete(id) : s.add(id); setActive(s); };

  const catById = useMemo(() => new Map((data?.categories ?? []).map((c) => [c.id, c])), [data]);
  const style = useMemo(() => {
    const m = new Map<number, { color: string; dash: string }>();
    const perCat = new Map<number, number>();
    for (const e of withData) {
      const i = perCat.get(e.category_id) ?? 0;
      perCat.set(e.category_id, i + 1);
      m.set(e.id, { color: catById.get(e.category_id)?.color ?? '#8d95a3', dash: DASHES[i % DASHES.length] });
    }
    return m;
  }, [withData, catById]);

  // Fitnessniveau (unabhängig von der Auswahl – immer über alle Übungen)
  const timeline = useMemo(() => (data ? fitnessTimeline(data.exercises, data.activity, today) : []), [data, today]);
  const trend = useMemo(() => fitnessTrend(timeline), [timeline]);

  // Reihen für das Diagramm
  const visible = withData.filter((e) => active.has(e.id));
  const series = visible.map((e) => {
    const raw = seriesOf(e, metric);
    const pts = mode === 'pct' ? toPercent(raw) : raw;
    return { ex: e, bw: isBodyweight(e), raw, s: { id: e.id, name: e.name, ...style.get(e.id)!, points: pts } as Series };
  }).filter((x) => x.s.points.length);

  const panels: Panel[] = mode === 'pct'
    ? (series.length ? [{ key: 'pct', title: `${METRIC_LABEL[metric]} in % der ersten Einheit`, unit: '%', series: series.map((x) => x.s), baseline: 100 }] : [])
    : [
        { key: 'kg', title: metric === 'volume' ? 'Volumen (kg × Wdh)' : metric === 'e1rm' ? 'Geschätztes 1RM (kg)' : 'Top-Gewicht (kg)', unit: 'kg', series: series.filter((x) => !x.bw).map((x) => x.s) },
        { key: 'reps', title: metric === 'volume' ? 'Wiederholungen gesamt (Körpergewicht)' : 'Max. Wiederholungen (Körpergewicht)', unit: 'Wdh', series: series.filter((x) => x.bw).map((x) => x.s) },
      ].filter((p) => p.series.length);

  const allT = series.flatMap((x) => x.s.points.map((p) => p.t));
  const tToday = tOf(today);
  const rd = RANGE_DAYS[range];
  const from = Math.max(allT.length ? Math.min(...allT) : tToday - 30 * DAY, rd ? tToday - rd * DAY : -Infinity) - 2 * DAY;
  const to = Math.max(tToday, allT.length ? Math.max(...allT) : tToday) + 2 * DAY;

  const unitOf = (bw: boolean) => (mode === 'pct' ? '%' : bw ? 'Wdh' : metric === 'volume' ? 'kg×Wdh' : 'kg');
  const readout = day ? series.map((x) => ({ x, p: x.s.points.find((p) => p.date === day) })).filter((r) => r.p) : [];

  if (!data) return <><div className="topbar"><h1 className="title">Fortschritt</h1></div><div className="skeleton" style={{ height: 140 }} /><div className="skeleton" style={{ height: 240 }} /></>;

  return (
    <>
      <div className="topbar"><h1 className="title">Fortschritt</h1></div>
      <FitnessCard timeline={timeline} trend={trend} />

      {withData.length === 0 ? (
        <p className="muted">Noch keine Trainings erfasst – sobald du Übungen einträgst, erscheint hier dein Verlauf.</p>
      ) : (
        <>
          <div className="ctrl-row">
            <div className="seg">
              <button className={mode === 'abs' ? 'on' : ''} onClick={() => { setMode('abs'); persist({ mode: 'abs' }); }}>kg / Wdh</button>
              <button className={mode === 'pct' ? 'on' : ''} onClick={() => { setMode('pct'); persist({ mode: 'pct' }); }}>%</button>
            </div>
            <div className="seg">
              {(['top', 'e1rm', 'volume'] as Metric[]).map((m) => (
                <button key={m} className={metric === m ? 'on' : ''} onClick={() => { setMetric(m); persist({ metric: m }); }}>{METRIC_LABEL[m]}</button>
              ))}
            </div>
          </div>
          <div className="seg full range-seg">
            {(['3m', '6m', '1y', 'all'] as Range[]).map((r) => (
              <button key={r} className={range === r ? 'on' : ''} onClick={() => { setRange(r); persist({ range: r }); }}>{r === 'all' ? 'Alles' : r === '1y' ? '1 Jahr' : r.replace('m', ' Mon.')}</button>
            ))}
          </div>

          {panels.length ? (
            <MultiChart panels={panels} from={from} to={to} selected={day} onSelect={setDay} focus={focus} />
          ) : (
            <div className="card muted small">Keine Übung ausgewählt – unten Kategorien oder Übungen einschalten.</div>
          )}

          <div className="readout">
            {day && readout.length ? (
              <>
                <div className="readout-head">
                  <b>{fmtDate(day, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</b>
                  <button className="faint small" onClick={() => setDay(null)}>✕</button>
                </div>
                {readout.map(({ x, p }) => {
                  const base = x.raw[0]?.v;
                  const rawV = x.raw.find((r) => r.date === day)?.v ?? 0;
                  return (
                    <div key={x.s.id} className="readout-row tnum">
                      <Swatch color={x.s.color} dash={x.s.dash} />
                      <span className="readout-name">{x.s.name}</span>
                      <b>{num(p!.v)} {unitOf(x.bw)}</b>
                      {mode === 'abs' && base ? <span className="faint">{num(Math.round((rawV / base) * 100))} %</span> : null}
                    </div>
                  );
                })}
              </>
            ) : (
              <span className="faint small">Tippe in den Graphen, um die Werte eines Trainingstags zu sehen.</span>
            )}
          </div>

          <div className="label">Angezeigt</div>
          <div className="chips wrap">
            <button className="chip" onClick={() => setActive(new Set(defaultSel))}>★ Standard</button>
            <button className="chip" onClick={() => setActive(new Set(withData.map((e) => e.id)))}>Alle</button>
            <button className="chip" onClick={() => setActive(new Set())}>Keine</button>
          </div>
          <div className="chips wrap">
            {data.categories.map((c) => {
              const exs = withData.filter((e) => e.category_id === c.id);
              if (!exs.length) return null;
              const on = exs.filter((e) => active.has(e.id)).length;
              return (
                <button key={c.id} className={`chip cat-toggle ${on === exs.length ? 'on' : on ? 'part' : ''}`}
                  onClick={() => { const s = new Set(active); exs.forEach((e) => (on ? s.delete(e.id) : s.add(e.id))); setActive(s); }}
                  aria-pressed={on === exs.length}>
                  <span className="cat-dot" style={{ background: c.color }} />{c.name}<span className="faint tnum">{on}/{exs.length}</span>
                </button>
              );
            })}
          </div>
          <button className="btn full" style={{ margin: '4px 0 12px' }} onClick={() => setPicker(!picker)}>{picker ? 'Einzelauswahl schließen' : 'Übungen einzeln wählen'}</button>
          {picker && data.categories.map((c) => {
            const exs = withData.filter((e) => e.category_id === c.id);
            if (!exs.length) return null;
            return (
              <div key={c.id} className="pick-group">
                <div className="pick-group-head"><span className="cat-dot" style={{ background: c.color }} />{c.name}</div>
                <div className="chips wrap">
                  {exs.map((e) => (
                    <button key={e.id} className={`chip ex-toggle ${active.has(e.id) ? 'on' : ''} ${e.archived ? 'archived' : ''}`} onClick={() => toggle(e.id)} aria-pressed={active.has(e.id)}>
                      <Swatch color={style.get(e.id)!.color} dash={style.get(e.id)!.dash} />{e.name}{e.favorite && <span className="star-inline">★</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {series.length > 0 && (
            <>
              <div className="label">Übungen im Diagramm</div>
              <div className="card legend-list">
                {series.map((x) => {
                  const pts = x.raw;
                  const first = pts[0], last = pts[pts.length - 1];
                  const pct = first && last ? Math.round((last.v / first.v - 1) * 100) : 0;
                  return (
                    <div key={x.s.id} className={`legend-row ${focus === x.s.id ? 'focus' : ''}`}>
                      <button className="legend-main" onClick={() => setFocus(focus === x.s.id ? null : x.s.id)} aria-pressed={focus === x.s.id}>
                        <Swatch color={x.s.color} dash={x.s.dash} />
                        <span className="legend-name">{x.s.name}</span>
                        <span className="tnum legend-val">{num(last.v)} {x.bw ? 'Wdh' : metric === 'volume' ? '' : 'kg'}</span>
                        <span className={`tnum legend-pct ${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}`}>{pct > 0 ? '+' : ''}{pct} %</span>
                      </button>
                      <Link href={`/fortschritt/${x.s.id}`} className="legend-link" aria-label={`Details zu ${x.s.name}`}><IconRight /></Link>
                    </div>
                  );
                })}
                <p className="faint small" style={{ margin: '8px 0 0' }}>Antippen hebt eine Übung im Diagramm hervor · Pfeil öffnet alle Einheiten · % = letzte vs. erste Einheit</p>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function Swatch({ color, dash }: { color: string; dash: string }) {
  return (
    <svg className="swatch-line" viewBox="0 0 22 8" aria-hidden="true">
      <line x1="1" y1="4" x2="21" y2="4" stroke={color} strokeWidth="2.5" strokeDasharray={dash ? dash.split(' ').map((n) => Number(n) * 0.7).join(' ') : undefined} strokeLinecap="round" />
    </svg>
  );
}
